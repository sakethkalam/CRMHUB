import asyncio
import json
import csv
import os
from datetime import datetime
from typing import Dict, Any

# Mock configuration for external systems
SAP_ODATA_ENDPOINT = "https://sap.your-org.com/odata/v4/SalesOrder"
DATALAKE_LOCAL_DROP_DIR = "./data_lake_drop"

async def sync_opportunity_to_sap(opportunity_data: Dict[str, Any]) -> bool:
    """
    Simulates an asynchronous HTTP request (e.g., via httpx) to an SAP OData endpoint.
    In an Event-Driven architecture, this would ideally be triggered by an Azure Service Bus 
    Queue message rather than blocking the main FastAPI thread.
    """
    print(f"\n[SAP INTEGRATION] Preparing payload for Opportunity ID: {opportunity_data.get('id')}...")
    
    # Transform CRM data payload into SAP expected format
    sap_payload = {
        "ErpSalesOrderId": f"CRM-{opportunity_data.get('id')}",
        "Amount": opportunity_data.get('amount'),
        "CloseDate": str(opportunity_data.get('expected_close_date')),
        "Status": opportunity_data.get('stage'),
        "System": "FastAPI CRM"
    }
    
    # Simulate network delay to SAP API Management Gateway
    await asyncio.sleep(2)
    
    # In reality, you would use:
    # async with httpx.AsyncClient() as client:
    #     response = await client.post(SAP_ODATA_ENDPOINT, json=sap_payload)
    
    print(f"[SAP INTEGRATION] ✅ Successfully synced to {SAP_ODATA_ENDPOINT}")
    print(f"Payload sent: {json.dumps(sap_payload, indent=2)}\n")
    return True

async def export_contact_to_datalake(contact_data: Dict[str, Any]) -> str:
    """
    Simulates dumping a new record into Azure Data Lake Storage (ADLS Gen2).
    Databricks 'Auto Loader' would pick up this file continuously for analytics/AI pipelines.
    We are simulating this by writing a CSV locally.
    """
    print(f"\n[DATABRICKS INTEGRATION] Exporting Contact ID: {contact_data.get('id')} to Data Lake...")
    
    # Ensure local directory exists for the simulation
    os.makedirs(DATALAKE_LOCAL_DROP_DIR, exist_ok=True)
    
    filename = f"contact_ingest_{contact_data.get('id')}_{int(datetime.now().timestamp())}.csv"
    filepath = os.path.join(DATALAKE_LOCAL_DROP_DIR, filename)
    
    # Simulate IO/Network delay
    await asyncio.sleep(1)
    
    # Write to local CSV representing Azure Data Lake Storage
    with open(filepath, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=contact_data.keys())
        writer.writeheader()
        writer.writerow(contact_data)
        
    print(f"[DATABRICKS INTEGRATION] ✅ Dropped file {filepath} for Databricks Auto Loader.\n")
    return filepath
