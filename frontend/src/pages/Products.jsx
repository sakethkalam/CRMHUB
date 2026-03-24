import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Package, X, ChevronDown, ChevronRight,
  Folder, FolderOpen, FileText, Edit2, PowerOff, CheckCircle2,
  LayoutList, GitBranch, AlertTriangle,
} from 'lucide-react';
import { api } from '../context/AuthContext';

// ── Shared style constants (match existing pages) ──────────
const inputCls =
  'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all placeholder:text-slate-400';
const selectCls =
  'w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-white transition-all cursor-pointer';
const labelCls = 'block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

// ── Badge configs ──────────────────────────────────────────
const REG_STATUS_STYLES = {
  Approved:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700',
  Pending:         'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-700',
  Discontinued:    'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700',
  Investigational: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700',
};
const DEVICE_CLASS_STYLES = {
  'Class I':   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-700',
  'Class II':  'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700',
  'Class III': 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-700',
};
const REG_STATUS_OPTIONS   = ['Approved', 'Pending', 'Discontinued', 'Investigational'];
const DEVICE_CLASS_OPTIONS = ['Class I', 'Class II', 'Class III'];

// ── Reusable toggle pill ───────────────────────────────────
const Toggle = ({ value, onChange, size = 'sm' }) => {
  const w = size === 'sm' ? 'w-9 h-5' : 'w-10 h-6';
  const d = size === 'sm' ? 'w-4 h-4 top-0.5 left-0.5' : 'w-4 h-4 top-1 left-1';
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative ${w} rounded-full transition-colors ${value ? 'bg-crmAccent' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <div className={`absolute ${d} bg-white rounded-full shadow transition-transform ${value ? (size === 'sm' ? 'translate-x-4' : 'translate-x-4') : ''}`} />
    </button>
  );
};

// ── Toast ──────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border ${
      isErr
        ? 'bg-red-50 dark:bg-red-900/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
        : 'bg-emerald-50 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
    }`}>
      {isErr ? <X size={16} /> : <CheckCircle2 size={16} />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
};

// ── Confirm dialog ─────────────────────────────────────────
const ConfirmDialog = ({ open, title, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-crmCard w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Drawer shell ───────────────────────────────────────────
const DrawerShell = ({ onClose, iconBg, icon: Icon, title, children }) => (
  <>
    <div className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} />
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white dark:bg-crmCard shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon size={18} />
          </div>
          <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </>
);

// ── Product drawer form ────────────────────────────────────
const ProductDrawerForm = ({ drawer, allCategories, allFamilies, onClose, onSaved, showToast }) => {
  const isEdit  = drawer.mode === 'edit';
  const product = drawer.data;

  const getInitialCatId = () => {
    if (product?.family?.category?.id) return String(product.family.category.id);
    if (drawer.defaultFamilyId) {
      const f = allFamilies.find(x => x.id === drawer.defaultFamilyId);
      return f ? String(f.category_id) : '';
    }
    return '';
  };

  const [form, setForm] = useState({
    sku:               product?.sku              || '',
    name:              product?.name             || '',
    category_id:       getInitialCatId(),
    family_id:         String(product?.family_id || product?.family?.id || drawer.defaultFamilyId || ''),
    unit_price:        product?.unit_price       ?? '',
    currency:          product?.currency         || 'USD',
    unit_of_measure:   product?.unit_of_measure  || '',
    device_class:      product?.device_class     || '',
    regulatory_status: product?.regulatory_status|| 'Pending',
    launch_date:       product?.launch_date       ? product.launch_date.slice(0, 10) : '',
    discontinue_date:  product?.discontinue_date  ? product.discontinue_date.slice(0, 10) : '',
    description:       product?.description      || '',
    is_active:         product?.is_active        ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filteredFamilies = useMemo(() =>
    form.category_id
      ? allFamilies.filter(f => String(f.category_id) === form.category_id)
      : allFamilies,
  [allFamilies, form.category_id]);

  const validate = () => {
    const e = {};
    if (!form.sku.trim())  e.sku       = 'SKU is required';
    if (!form.name.trim()) e.name      = 'Name is required';
    if (!form.family_id)   e.family_id = 'Family is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        sku:               form.sku.trim(),
        name:              form.name.trim(),
        family_id:         Number(form.family_id),
        unit_price:        form.unit_price !== '' ? Number(form.unit_price) : undefined,
        currency:          form.currency          || undefined,
        unit_of_measure:   form.unit_of_measure   || undefined,
        device_class:      form.device_class      || undefined,
        regulatory_status: form.regulatory_status || undefined,
        launch_date:       form.launch_date       || undefined,
        discontinue_date:  form.discontinue_date  || undefined,
        description:       form.description       || undefined,
        is_active:         form.is_active,
      };
      if (isEdit) {
        await api.patch(`/products/${product.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save product', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      iconBg="bg-crmAccent/10 text-crmAccent"
      icon={Package}
      title={isEdit ? 'Edit Product' : 'New Product'}
    >
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 p-5 space-y-4">
          {/* SKU */}
          <div>
            <label className={labelCls}>SKU <span className="text-red-500">*</span></label>
            <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)}
              className={`${inputCls} ${errors.sku ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="e.g. REL-28150-TH" />
            {errors.sku && <p className="mt-1 text-xs text-red-500">{errors.sku}</p>}
          </div>

          {/* Name */}
          <div>
            <label className={labelCls}>Product Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className={`${inputCls} ${errors.name ? 'border-red-400 focus:ring-red-400' : ''}`}
              placeholder="e.g. RelayPro 28×150mm" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Category → Family cascade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={form.category_id}
                onChange={e => { set('category_id', e.target.value); set('family_id', ''); }}
                className={selectCls}>
                <option value="">All categories</option>
                {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Family <span className="text-red-500">*</span></label>
              <select value={form.family_id} onChange={e => set('family_id', e.target.value)}
                className={`${selectCls} ${errors.family_id ? 'border-red-400' : ''}`}>
                <option value="">Select family…</option>
                {filteredFamilies.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {errors.family_id && <p className="mt-1 text-xs text-red-500">{errors.family_id}</p>}
            </div>
          </div>

          {/* Price + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit Price</label>
              <input type="number" min="0" step="0.01" value={form.unit_price}
                onChange={e => set('unit_price', e.target.value)}
                className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input type="text" value={form.currency} maxLength={10}
                onChange={e => set('currency', e.target.value.toUpperCase())}
                className={inputCls} placeholder="USD" />
            </div>
          </div>

          {/* UoM */}
          <div>
            <label className={labelCls}>Unit of Measure</label>
            <input type="text" value={form.unit_of_measure}
              onChange={e => set('unit_of_measure', e.target.value)}
              className={inputCls} placeholder="e.g. Each, Box, Kit" />
          </div>

          {/* Device Class + Reg Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Device Class</label>
              <select value={form.device_class} onChange={e => set('device_class', e.target.value)} className={selectCls}>
                <option value="">None</option>
                {DEVICE_CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Regulatory Status</label>
              <select value={form.regulatory_status} onChange={e => set('regulatory_status', e.target.value)} className={selectCls}>
                {REG_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Launch Date</label>
              <input type="date" value={form.launch_date} onChange={e => set('launch_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Discontinue Date</label>
              <input type="date" value={form.discontinue_date} onChange={e => set('discontinue_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              className={inputCls} placeholder="Optional product description…" />
          </div>

          {/* Is Active */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Is Active</span>
            <Toggle value={form.is_active} onChange={v => set('is_active', v)} size="lg" />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-crmAccent hover:bg-crmHover disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:ring-4 focus:ring-blue-500/30 active:scale-[0.98]">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Product')}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
};

// ── Category drawer form ───────────────────────────────────
const CategoryDrawerForm = ({ drawer, onClose, onSaved, showToast }) => {
  const isEdit = drawer.mode === 'edit';
  const cat    = drawer.data;
  const [form, setForm] = useState({ name: cat?.name || '', description: cat?.description || '', is_active: cat?.is_active ?? true });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description || undefined, is_active: form.is_active };
      if (isEdit) { await api.patch(`/product-categories/${cat.id}`, payload); }
      else        { await api.post('/product-categories', payload); }
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save category', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      iconBg="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
      icon={Folder}
      title={isEdit ? 'Edit Category' : 'New Category'}
    >
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 p-5 space-y-4">
          <div>
            <label className={labelCls}>Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              placeholder="e.g. Aortic Stent Grafts" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              className={inputCls} placeholder="Optional description…" />
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Is Active</span>
            <Toggle value={form.is_active} onChange={v => set('is_active', v)} size="lg" />
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-crmAccent hover:bg-crmHover disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Category')}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
};

// ── Family drawer form ─────────────────────────────────────
const FamilyDrawerForm = ({ drawer, allCategories, onClose, onSaved, showToast }) => {
  const isEdit = drawer.mode === 'edit';
  const fam    = drawer.data;
  const [form, setForm] = useState({
    name:             fam?.name             || '',
    category_id:      fam?.category_id       ? String(fam.category_id) : (drawer.defaultCategoryId ? String(drawer.defaultCategoryId) : ''),
    therapeutic_area: fam?.therapeutic_area  || '',
    description:      fam?.description       || '',
    is_active:        fam?.is_active         ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name        = 'Name is required';
    if (!form.category_id)  e.category_id = 'Category is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        name:             form.name.trim(),
        category_id:      Number(form.category_id),
        therapeutic_area: form.therapeutic_area || undefined,
        description:      form.description      || undefined,
        is_active:        form.is_active,
      };
      if (isEdit) { await api.patch(`/product-families/${fam.id}`, payload); }
      else        { await api.post('/product-families', payload); }
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to save family', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DrawerShell
      onClose={onClose}
      iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
      icon={FolderOpen}
      title={isEdit ? 'Edit Family' : 'New Family'}
    >
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 p-5 space-y-4">
          <div>
            <label className={labelCls}>Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              placeholder="e.g. Thoracic Endovascular" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className={labelCls}>Category <span className="text-red-500">*</span></label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
              className={`${selectCls} ${errors.category_id ? 'border-red-400' : ''}`}>
              <option value="">Select category…</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.category_id && <p className="mt-1 text-xs text-red-500">{errors.category_id}</p>}
          </div>
          <div>
            <label className={labelCls}>Therapeutic Area</label>
            <input type="text" value={form.therapeutic_area}
              onChange={e => set('therapeutic_area', e.target.value)}
              className={inputCls} placeholder="e.g. Cardiovascular, Neurology" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              className={inputCls} placeholder="Optional description…" />
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Is Active</span>
            <Toggle value={form.is_active} onChange={v => set('is_active', v)} size="lg" />
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 bg-crmAccent hover:bg-crmHover disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Family')}
          </button>
        </div>
      </form>
    </DrawerShell>
  );
};

// ═══════════════════════════════════════════════════════════
// Products (main page)
// ═══════════════════════════════════════════════════════════
const Products = () => {
  const [viewMode, setViewMode] = useState('table');

  // ── Data ──────────────────────────────────────────────────
  const [products,   setProducts]   = useState([]);
  const [hierarchy,  setHierarchy]  = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [treeLoading,  setTreeLoading]  = useState(true);

  // ── Table filters ──────────────────────────────────────────
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [famFilter,    setFamFilter]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // ── Tree expand state ──────────────────────────────────────
  const [expanded, setExpanded] = useState({});

  // ── Drawers ────────────────────────────────────────────────
  const [productDrawer,  setProductDrawer]  = useState(null);
  const [categoryDrawer, setCategoryDrawer] = useState(null);
  const [familyDrawer,   setFamilyDrawer]   = useState(null);

  // ── Confirm deactivate ─────────────────────────────────────
  const [confirmItem, setConfirmItem] = useState(null);

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived from hierarchy ─────────────────────────────────
  const allCategories = useMemo(() => hierarchy, [hierarchy]);

  const allFamilies = useMemo(() =>
    hierarchy.flatMap(h => h.families.map(f => ({ ...f, category_id: h.id }))),
  [hierarchy]);

  const filteredFamiliesForFilter = useMemo(() =>
    catFilter ? allFamilies.filter(f => String(f.category_id) === catFilter) : allFamilies,
  [allFamilies, catFilter]);

  // ── Fetch hierarchy ────────────────────────────────────────
  const fetchHierarchy = async () => {
    setTreeLoading(true);
    try {
      const res = await api.get('/products/hierarchy');
      setHierarchy(res.data);
    } catch {
      showToast('Failed to load product hierarchy', 'error');
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => { fetchHierarchy(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand all categories on first hierarchy load
  useEffect(() => {
    if (hierarchy.length > 0 && Object.keys(expanded).length === 0) {
      const init = {};
      hierarchy.forEach(h => { init[`cat-${h.id}`] = true; });
      setExpanded(init);
    }
  }, [hierarchy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch products (debounced on filter changes) ───────────
  const fetchProducts = async () => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)        params.set('search',             search);
      if (catFilter)     params.set('category_id',        catFilter);
      if (famFilter)     params.set('family_id',          famFilter);
      if (statusFilter)  params.set('regulatory_status',  statusFilter);
      if (!showInactive) params.set('is_active',          'true');
      const res = await api.get(`/products?${params}`);
      setProducts(res.data);
    } catch {
      showToast('Failed to load products', 'error');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [search, catFilter, famFilter, statusFilter, showInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle active ──────────────────────────────────────────
  const handleToggleActive = async (product, e) => {
    e?.stopPropagation();
    if (product.is_active) {
      setConfirmItem(product);
    } else {
      try {
        await api.patch(`/products/${product.id}`, { is_active: true });
        showToast(`${product.name} activated`);
        fetchProducts();
        fetchHierarchy();
      } catch {
        showToast('Failed to update product', 'error');
      }
    }
  };

  const confirmDeactivate = async () => {
    if (!confirmItem) return;
    try {
      await api.patch(`/products/${confirmItem.id}`, { is_active: false });
      showToast(`${confirmItem.name} deactivated`);
      setConfirmItem(null);
      fetchProducts();
      fetchHierarchy();
    } catch {
      showToast('Failed to deactivate product', 'error');
    }
  };

  const toggleNode = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Refresh helpers (passed to drawers) ───────────────────
  const refreshAll = useCallback(() => {
    fetchProducts();
    fetchHierarchy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Package className="text-crmAccent w-7 h-7" /> Products
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your product catalog, families, and categories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            {[
              { id: 'table', label: 'Table',     Icon: LayoutList },
              { id: 'tree',  label: 'Hierarchy', Icon: GitBranch  },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {viewMode === 'table' && (
            <button
              onClick={() => setProductDrawer({ mode: 'create' })}
              className="bg-crmAccent hover:bg-crmHover text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm focus:ring-4 focus:ring-blue-500/20"
            >
              <Plus size={18} /> New Product
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          TABLE VIEW
      ══════════════════════════════════════════════════════ */}
      {viewMode === 'table' && (
        <>
          {/* Filter bar */}
          <div className="bg-white dark:bg-crmCard p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by name or SKU…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Category */}
            <select
              value={catFilter}
              onChange={e => { setCatFilter(e.target.value); setFamFilter(''); }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
            >
              <option value="">All Categories</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Family */}
            <select
              value={famFilter}
              onChange={e => setFamFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
            >
              <option value="">All Families</option>
              {filteredFamiliesForFilter.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            {/* Reg status */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-crmAccent dark:text-slate-200 cursor-pointer"
            >
              <option value="">All Statuses</option>
              {REG_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Show inactive */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Toggle value={showInactive} onChange={setShowInactive} size="sm" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Show Inactive</span>
            </label>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold">SKU</th>
                    <th className="px-6 py-3.5 font-semibold">Product Name</th>
                    <th className="px-6 py-3.5 font-semibold">Family</th>
                    <th className="px-6 py-3.5 font-semibold">Category</th>
                    <th className="px-6 py-3.5 font-semibold">Unit Price</th>
                    <th className="px-6 py-3.5 font-semibold">Device Class</th>
                    <th className="px-6 py-3.5 font-semibold">Reg. Status</th>
                    <th className="px-6 py-3.5 font-semibold text-center">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">Loading products…</span>
                        </div>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-slate-500 text-sm">
                        No products found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    products.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => setProductDrawer({ mode: 'edit', data: p })}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{p.sku}</td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{p.name}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{p.family?.name || '—'}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{p.family?.category?.name || '—'}</td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                          {p.unit_price != null
                            ? `${p.currency || 'USD'} ${Number(p.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </td>
                        <td className="px-6 py-4">
                          {p.device_class ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${DEVICE_CLASS_STYLES[p.device_class] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {p.device_class}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          {p.regulatory_status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${REG_STATUS_STYLES[p.regulatory_status] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {p.regulatory_status}
                            </span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4 text-center" onClick={e => e.stopPropagation()}>
                          <Toggle value={p.is_active} onChange={() => handleToggleActive(p)} size="sm" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          HIERARCHY TREE VIEW
      ══════════════════════════════════════════════════════ */}
      {viewMode === 'tree' && (
        <div className="bg-white dark:bg-crmCard rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Tree toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Product Hierarchy</h3>
            <button
              onClick={() => setCategoryDrawer({ mode: 'create' })}
              className="bg-crmAccent hover:bg-crmHover text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Add Category
            </button>
          </div>

          {treeLoading ? (
            <div className="flex flex-col items-center py-16 gap-2 text-slate-500">
              <div className="w-6 h-6 border-2 border-crmAccent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading hierarchy…</span>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No categories yet. Click <span className="font-semibold">Add Category</span> to get started.
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {hierarchy.map((category) => {
                const catKey    = `cat-${category.id}`;
                const isCatOpen = !!expanded[catKey];

                return (
                  <div key={category.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">

                    {/* ── Category row ── */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <button onClick={() => toggleNode(catKey)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0">
                        {isCatOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {isCatOpen
                        ? <FolderOpen size={16} className="text-amber-500 flex-shrink-0" />
                        : <Folder     size={16} className="text-amber-400 flex-shrink-0" />}
                      <span className="font-semibold text-slate-900 dark:text-white text-sm flex-1">{category.name}</span>
                      {!category.is_active && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Inactive</span>
                      )}
                      <span className="text-xs text-slate-400 mr-2">{category.families.length} families</span>
                      <button
                        onClick={() => setFamilyDrawer({ mode: 'create', defaultCategoryId: category.id })}
                        className="text-xs font-medium text-crmAccent hover:text-crmHover flex items-center gap-1 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                      >
                        <Plus size={13} /> Family
                      </button>
                      <button
                        onClick={() => setCategoryDrawer({ mode: 'edit', data: category })}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>

                    {/* ── Families (animated) ── */}
                    <div style={{ display: 'grid', gridTemplateRows: isCatOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                        {category.families.length === 0 ? (
                          <p className="px-12 py-4 text-sm text-slate-400 italic">No families yet.</p>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {category.families.map((family) => {
                              const famProds   = family.products || [];
                              const famKey    = `fam-${family.id}`;
                              const isFamOpen = !!expanded[famKey];

                              return (
                                <div key={family.id}>
                                  {/* ── Family row ── */}
                                  <div className="flex items-center gap-2 pl-8 pr-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                    <button onClick={() => toggleNode(famKey)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0">
                                      {isFamOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                    {isFamOpen
                                      ? <FolderOpen size={14} className="text-blue-400 flex-shrink-0" />
                                      : <Folder     size={14} className="text-blue-300 flex-shrink-0" />}
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1">{family.name}</span>
                                    {!family.is_active && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">Inactive</span>
                                    )}
                                    <span className="text-xs text-slate-400 mr-2">{famProds.length} products</span>
                                    <button
                                      onClick={() => setProductDrawer({ mode: 'create', defaultFamilyId: family.id })}
                                      className="text-xs font-medium text-crmAccent hover:text-crmHover flex items-center gap-1 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                    >
                                      <Plus size={13} /> Product
                                    </button>
                                    <button
                                      onClick={() => setFamilyDrawer({ mode: 'edit', data: { ...family, category_id: category.id } })}
                                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                  </div>

                                  {/* ── Products (animated) ── */}
                                  <div style={{ display: 'grid', gridTemplateRows: isFamOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.2s ease' }}>
                                    <div style={{ overflow: 'hidden' }}>
                                      {famProds.length === 0 ? (
                                        <p className="pl-16 pr-4 py-2 text-xs text-slate-400 italic">No products in this family.</p>
                                      ) : (
                                        <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
                                          {famProds.map(prod => (
                                            <div
                                              key={prod.id}
                                              className="flex items-center gap-3 pl-16 pr-4 py-2 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors group"
                                            >
                                              <FileText size={13} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 flex-1 truncate">{prod.name}</span>
                                              <span className="text-xs text-slate-400 font-mono hidden sm:block">{prod.sku}</span>
                                              {prod.unit_price != null && (
                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                  {prod.currency || 'USD'} {Number(prod.unit_price).toLocaleString()}
                                                </span>
                                              )}
                                              {prod.regulatory_status && (
                                                <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${REG_STATUS_STYLES[prod.regulatory_status] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                  {prod.regulatory_status}
                                                </span>
                                              )}
                                              {!prod.is_active && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-400">Inactive</span>
                                              )}
                                              {/* Actions — visible on hover */}
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={() => setProductDrawer({ mode: 'edit', data: prod })}
                                                  className="p-1 text-slate-400 hover:text-crmAccent hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                  title="Edit product"
                                                >
                                                  <Edit2 size={13} />
                                                </button>
                                                <button
                                                  onClick={() => prod.is_active ? setConfirmItem(prod) : handleToggleActive(prod)}
                                                  className={`p-1 rounded transition-colors ${
                                                    prod.is_active
                                                      ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                      : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                  }`}
                                                  title={prod.is_active ? 'Deactivate' : 'Activate'}
                                                >
                                                  <PowerOff size={13} />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Drawers ──────────────────────────────────────────── */}
      {productDrawer && (
        <ProductDrawerForm
          drawer={productDrawer}
          allCategories={allCategories}
          allFamilies={allFamilies}
          onClose={() => setProductDrawer(null)}
          onSaved={() => {
            setProductDrawer(null);
            refreshAll();
            showToast(productDrawer.mode === 'create' ? 'Product created' : 'Product updated');
          }}
          showToast={showToast}
        />
      )}

      {categoryDrawer && (
        <CategoryDrawerForm
          drawer={categoryDrawer}
          onClose={() => setCategoryDrawer(null)}
          onSaved={() => {
            setCategoryDrawer(null);
            fetchHierarchy();
            showToast(categoryDrawer.mode === 'create' ? 'Category created' : 'Category updated');
          }}
          showToast={showToast}
        />
      )}

      {familyDrawer && (
        <FamilyDrawerForm
          drawer={familyDrawer}
          allCategories={allCategories}
          onClose={() => setFamilyDrawer(null)}
          onSaved={() => {
            setFamilyDrawer(null);
            fetchHierarchy();
            showToast(familyDrawer.mode === 'create' ? 'Family created' : 'Family updated');
          }}
          showToast={showToast}
        />
      )}

      {/* ── Confirm deactivate ───────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmItem}
        title="Deactivate Product"
        message={`Are you sure you want to deactivate "${confirmItem?.name}"? It will be hidden from active product lists.`}
        onConfirm={confirmDeactivate}
        onCancel={() => setConfirmItem(null)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default Products;
