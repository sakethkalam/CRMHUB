"""
routers/products.py — Full CRUD for the 3-level medical-device product hierarchy.

    ProductCategory  (top)
        └─ ProductFamily  (mid)
               └─ Product  (leaf / SKU)

RBAC
----
  GET endpoints            : any authenticated user (Sales Rep and above)
  POST / PATCH / DELETE    : Manager or Admin only

Route ordering note: /products/hierarchy and /products/summary are declared
BEFORE /products/{product_id} so FastAPI doesn't treat the literal strings
"hierarchy" / "summary" as integer path parameters.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List

from auth import get_current_user
from database import get_db
from models import (
    DeviceClass,
    Product,
    ProductCategory,
    ProductFamily,
    RegulatoryStatus,
    User,
    UserRole,
)
from permissions import ROLE_RANK, require_role
from schemas import (
    ProductCategoryCreate,
    ProductCategoryRead,
    ProductCategoryUpdate,
    ProductCreate,
    ProductFamilyCreate,
    ProductFamilyRead,
    ProductFamilyUpdate,
    ProductRead,
    ProductSummary,
    ProductUpdate,
)
from services.audit_service import log_change, snapshot

router = APIRouter(tags=["Products"])


# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

def _rank(user: User) -> int:
    role = user.role if isinstance(user.role, UserRole) else UserRole(user.role)
    return ROLE_RANK.get(role, 0)


def _require_manager(current_user: User) -> None:
    """Raise 403 if caller is below Manager rank."""
    if _rank(current_user) < ROLE_RANK[UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or Admin role required.",
        )


# ---------------------------------------------------------------------------
# Reusable eager-load option sets
# ---------------------------------------------------------------------------

def _category_options() -> list:
    """Full hierarchy: Category → families (with category back-ref) → products (with family.category)."""
    return [
        selectinload(ProductCategory.families).options(
            selectinload(ProductFamily.category),
            selectinload(ProductFamily.products).options(
                selectinload(Product.family).options(
                    selectinload(ProductFamily.category)
                )
            ),
        )
    ]


def _family_options() -> list:
    """Family with its parent category and child products (product.family.category loaded)."""
    return [
        selectinload(ProductFamily.category),
        selectinload(ProductFamily.products).options(
            selectinload(Product.family).options(
                selectinload(ProductFamily.category)
            )
        ),
    ]


def _product_options() -> list:
    """Product with family and family.category — enough for ProductRead and ProductSummary."""
    return [
        selectinload(Product.family).options(
            selectinload(ProductFamily.category)
        )
    ]


# ---------------------------------------------------------------------------
# ProductSummary builder
# family_name / category_name are not ORM columns — build from loaded relations
# ---------------------------------------------------------------------------

def _to_summary(p: Product) -> ProductSummary:
    return ProductSummary(
        id=p.id,
        sku=p.sku,
        name=p.name,
        unit_price=p.unit_price,
        currency=p.currency,
        is_active=p.is_active,
        family_name=p.family.name if p.family else "",
        category_name=(p.family.category.name if p.family and p.family.category else ""),
    )


# ===========================================================================
# ProductCategory  —  /product-categories
# ===========================================================================

@router.get(
    "/product-categories",
    response_model=List[ProductCategoryRead],
    summary="List product categories",
)
async def list_categories(
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(ProductCategory)
        .options(*_category_options())
        .order_by(ProductCategory.name)
    )
    if is_active is not None:
        q = q.where(ProductCategory.is_active == is_active)
    result = await db.execute(q)
    return result.scalars().unique().all()


@router.post(
    "/product-categories",
    response_model=ProductCategoryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product category",
)
async def create_category(
    data: ProductCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    obj = ProductCategory(**data.model_dump())
    db.add(obj)
    await db.flush()
    await log_change(
        db, table_name="product_categories", record_id=obj.id,
        action="CREATE", new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.id == obj.id)
        .options(*_category_options())
    )
    return result.scalar_one()


@router.get(
    "/product-categories/{category_id}",
    response_model=ProductCategoryRead,
    summary="Get a product category with full hierarchy",
)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.id == category_id)
        .options(*_category_options())
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product category not found")
    return obj


@router.patch(
    "/product-categories/{category_id}",
    response_model=ProductCategoryRead,
    summary="Update a product category",
)
async def update_category(
    category_id: int,
    data: ProductCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    result = await db.execute(
        select(ProductCategory).where(ProductCategory.id == category_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product category not found")
    old = snapshot(obj)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await log_change(
        db, table_name="product_categories", record_id=category_id,
        action="UPDATE", old_values=old, new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    refreshed = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.id == category_id)
        .options(*_category_options())
    )
    return refreshed.scalar_one()


@router.delete(
    "/product-categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product category (blocked if families exist)",
)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    result = await db.execute(
        select(ProductCategory).where(ProductCategory.id == category_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product category not found")

    family_exists = (await db.execute(
        select(ProductFamily).where(ProductFamily.category_id == category_id).limit(1)
    )).scalar_one_or_none()
    if family_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete category with existing product families",
        )

    old = snapshot(obj)
    await db.delete(obj)
    await log_change(
        db, table_name="product_categories", record_id=category_id,
        action="DELETE", old_values=old,
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    return None


# ===========================================================================
# ProductFamily  —  /product-families
# ===========================================================================

@router.get(
    "/product-families",
    response_model=List[ProductFamilyRead],
    summary="List product families",
)
async def list_families(
    category_id: int | None = Query(None, description="Filter by parent category"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(ProductFamily)
        .options(*_family_options())
        .order_by(ProductFamily.name)
    )
    if category_id is not None:
        q = q.where(ProductFamily.category_id == category_id)
    if is_active is not None:
        q = q.where(ProductFamily.is_active == is_active)
    result = await db.execute(q)
    return result.scalars().unique().all()


@router.post(
    "/product-families",
    response_model=ProductFamilyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product family",
)
async def create_family(
    data: ProductFamilyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    cat = (await db.execute(
        select(ProductCategory).where(ProductCategory.id == data.category_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Product category not found")

    obj = ProductFamily(**data.model_dump())
    db.add(obj)
    await db.flush()
    await log_change(
        db, table_name="product_families", record_id=obj.id,
        action="CREATE", new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    result = await db.execute(
        select(ProductFamily)
        .where(ProductFamily.id == obj.id)
        .options(*_family_options())
    )
    return result.scalar_one()


@router.get(
    "/product-families/{family_id}",
    response_model=ProductFamilyRead,
    summary="Get a product family with its products",
)
async def get_family(
    family_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ProductFamily)
        .where(ProductFamily.id == family_id)
        .options(*_family_options())
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product family not found")
    return obj


@router.patch(
    "/product-families/{family_id}",
    response_model=ProductFamilyRead,
    summary="Update a product family",
)
async def update_family(
    family_id: int,
    data: ProductFamilyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    result = await db.execute(
        select(ProductFamily).where(ProductFamily.id == family_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product family not found")

    if data.category_id is not None:
        cat = (await db.execute(
            select(ProductCategory).where(ProductCategory.id == data.category_id)
        )).scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=404, detail="Product category not found")

    old = snapshot(obj)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await log_change(
        db, table_name="product_families", record_id=family_id,
        action="UPDATE", old_values=old, new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    refreshed = await db.execute(
        select(ProductFamily)
        .where(ProductFamily.id == family_id)
        .options(*_family_options())
    )
    return refreshed.scalar_one()


@router.delete(
    "/product-families/{family_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product family (blocked if products exist)",
)
async def delete_family(
    family_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    result = await db.execute(
        select(ProductFamily).where(ProductFamily.id == family_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product family not found")

    product_exists = (await db.execute(
        select(Product).where(Product.family_id == family_id).limit(1)
    )).scalar_one_or_none()
    if product_exists is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete family with existing products",
        )

    old = snapshot(obj)
    await db.delete(obj)
    await log_change(
        db, table_name="product_families", record_id=family_id,
        action="DELETE", old_values=old,
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    return None


# ===========================================================================
# Product  —  /products
# /products/hierarchy and /products/summary MUST stay above /products/{id}
# ===========================================================================

@router.get(
    "/products/hierarchy",
    response_model=List[ProductCategoryRead],
    summary="Full product tree (category → family → product)",
)
async def product_hierarchy(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the complete active hierarchy used to render the UI tree view."""
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.is_active == True)   # noqa: E712
        .options(*_category_options())
        .order_by(ProductCategory.name)
    )
    return result.scalars().unique().all()


@router.get(
    "/products/summary",
    response_model=List[ProductSummary],
    summary="Lightweight product list for dropdowns",
)
async def product_summary_list(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Active products only. Flat projection — no deep nesting."""
    result = await db.execute(
        select(Product)
        .where(Product.is_active == True)           # noqa: E712
        .options(*_product_options())
        .order_by(Product.name)
    )
    products = result.scalars().unique().all()
    return [_to_summary(p) for p in products]


@router.get(
    "/products",
    response_model=List[ProductRead],
    summary="List products with filters",
)
async def list_products(
    family_id: int | None = Query(None, description="Filter by product family"),
    category_id: int | None = Query(None, description="Filter by parent category"),
    regulatory_status: RegulatoryStatus | None = Query(None),
    device_class: DeviceClass | None = Query(None),
    is_active: bool | None = Query(None),
    search: str | None = Query(None, description="Search by name or SKU"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Product).options(*_product_options())

    if family_id is not None:
        q = q.where(Product.family_id == family_id)
    if category_id is not None:
        # Product has no direct category FK — join through family
        q = q.join(Product.family).where(ProductFamily.category_id == category_id)
    if regulatory_status is not None:
        q = q.where(Product.regulatory_status == regulatory_status.value)
    if device_class is not None:
        q = q.where(Product.device_class == device_class.value)
    if is_active is not None:
        q = q.where(Product.is_active == is_active)
    if search:
        pat = f"%{search}%"
        q = q.where(
            (Product.name.ilike(pat)) | (Product.sku.ilike(pat))
        )

    result = await db.execute(q.order_by(Product.name).offset(skip).limit(limit))
    return result.scalars().unique().all()


@router.post(
    "/products",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a product",
)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    fam = (await db.execute(
        select(ProductFamily).where(ProductFamily.id == data.family_id)
    )).scalar_one_or_none()
    if not fam:
        raise HTTPException(status_code=404, detail="Product family not found")

    obj = Product(**data.model_dump())
    db.add(obj)
    await db.flush()
    await log_change(
        db, table_name="products", record_id=obj.id,
        action="CREATE", new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    result = await db.execute(
        select(Product).where(Product.id == obj.id).options(*_product_options())
    )
    return result.scalar_one()


@router.get(
    "/products/{product_id}",
    response_model=ProductRead,
    summary="Get a product with full detail",
)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(*_product_options())
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    return obj


@router.patch(
    "/products/{product_id}",
    response_model=ProductRead,
    summary="Update a product",
)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager(current_user)
    result = await db.execute(select(Product).where(Product.id == product_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.family_id is not None:
        fam = (await db.execute(
            select(ProductFamily).where(ProductFamily.id == data.family_id)
        )).scalar_one_or_none()
        if not fam:
            raise HTTPException(status_code=404, detail="Product family not found")

    old = snapshot(obj)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    await log_change(
        db, table_name="products", record_id=product_id,
        action="UPDATE", old_values=old, new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    refreshed = await db.execute(
        select(Product).where(Product.id == product_id).options(*_product_options())
    )
    return refreshed.scalar_one()


@router.delete(
    "/products/{product_id}",
    response_model=ProductRead,
    summary="Soft-delete a product (sets is_active=False)",
)
async def deactivate_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Soft-delete only — sets is_active=False and returns the updated record.
    Hard deletion is intentionally blocked because historical Opportunity and
    Lead records reference products via the join tables.
    """
    _require_manager(current_user)
    result = await db.execute(select(Product).where(Product.id == product_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")

    old = snapshot(obj)
    obj.is_active = False
    await log_change(
        db, table_name="products", record_id=product_id,
        action="UPDATE", old_values=old, new_values=snapshot(obj),
        user_id=current_user.id, user_email=current_user.email,
    )
    await db.commit()
    refreshed = await db.execute(
        select(Product).where(Product.id == product_id).options(*_product_options())
    )
    return refreshed.scalar_one()
