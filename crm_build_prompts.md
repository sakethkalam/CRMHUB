# CRM Build Prompts

This document contains a sequential master plan of prompts to build the Custom CRM application (React + Python FastAPI). 

## Phase 1: Database & Core Architecture
*Before building APIs, we need a rock-solid foundation for our data.*

### Prompt 1: Database Setup & Schemas
> Act as a Senior Python Backend Architect. I am building a scalable CRM. In my `CRMHUB` directory, create or update `database.py` to set up SQLAlchemy with an Azure PostgreSQL connection string placeholder. Then, create a new file `models.py` that defines the SQLAlchemy ORM models for the following tables: 1) `User` 2) `Account` (Company) 3) `Contact` (Person at an Account) 4) `Opportunity` (Deal pipeline) and 5) `Activity` (Notes/Calls). Ensure relationships and foreign keys are mapped correctly.

## Phase 2: Backend APIs (Micro-Modules)
*Now we build the FastAPI endpoints to interact with the database.*

### Prompt 2: Authentication & User Management
> Act as a Backend Security Expert. For my FastAPI CRM, create `auth.py` and `routers/users.py`. Implement secure JWT (JSON Web Token) authentication. Provide the endpoints for user registration, user login (returning a token), and a secure dependency `get_current_user` that protects other routes. Ensure password hashing is implemented using `passlib`.

### Prompt 3: The 'Accounts & Contacts' Module
> For my FastAPI CRM, I need the Accounts and Contacts module endpoints. Create `routers/accounts.py` and `routers/contacts.py`. Write robust CRUD (Create, Read, Update, Delete) REST API endpoints. Include pagination (skip/limit) and basic search functionality by name or email. Make sure these routes are protected using the `get_current_user` dependency.

### Prompt 4: The 'Opportunities & Pipeline' Module
> For my FastAPI CRM, I need the Sales Pipeline module. Create `routers/opportunities.py`. Write CRUD endpoints for Opportunities. I need an endpoint specifically designed to update the 'Stage' of an opportunity (e.g., Prospecting, Qualification, Closed Won) so we can eventually build a drag-and-drop Kanban board on the frontend.

### Prompt 5: Integrations & Async Tasks
> For my FastAPI CRM, prepare the backend for Databricks and SAP integration. Create `services/integrations.py`. Write placeholder asynchronous functions that demonstrate how an Event-Driven architecture works: 1) A function that simulates sending a 'Closed Won' JSON payload to an SAP OData endpoint, and 2) a function that dumps new Contacts into a CSV/Parquet format locally, intended to simulate an Azure Data Lake drop for Databricks.

## Phase 3: Frontend Foundation & Auth
*Switching gears to React. We build the UI shell first.*

### Prompt 6: React Scaffolding & Tailwind Setup
> Act as a Senior Frontend Developer. I want to build the CRM frontend using React and Vite. Give me the terminal commands to initialize the Vite React app inside a `frontend` folder within `CRMHUB`. Then, provide the exact steps and configuration files (`tailwind.config.js`, `index.css`) to install and configure Tailwind CSS and Lucide React icons for a beautiful, modern, dark-mode accessible UI design.

### Prompt 7: Frontend Routing & Global State
> For my React CRM frontend, I need to set up routing and authentication state. Create a `src/App.jsx` with React Router protecting private routes. Create an Auth Context (`src/context/AuthContext.jsx`) that handles login, logout, and stores the JWT token securely in localStorage, and automatically attaches it to outgoing Axios requests.

## Phase 4: Frontend CRM Interfaces
*Building the visual components users will literally click on.*

### Prompt 8: The Global Layout (Sidebar & Nav)
> For my React CRM, build a premium, modern `Layout.jsx` component. It should have a fixed sidebar navigation (Dashboard, Accounts, Contacts, Opportunities, Settings) and a top header showing the current user's profile icon. Utilize Tailwind CSS for a sleek, enterprise aesthetic with subtle hover animations.

### Prompt 9: The Data Tables (Accounts & Contacts)
> For my React CRM, build the `Accounts.jsx` and `Contacts.jsx` page components. They should fetch data from the FastAPI backend and display it in a beautiful, responsive data table. Include a 'Create New' button that opens a modal with a form to add a new account or contact.

### Prompt 10: The Sales Pipeline (Kanban Board)
> For my React CRM, build the `Opportunities.jsx` page. Visually, this must be a Kanban board with distinct columns mapping to deal stages (Prospecting, Proposal, Negotiation, Closed). Do not worry about actual drag-and-drop library implementations yet; just build the CSS grid layout, fetch the opportunities from the backend, and map realistic React components into the correct columns.
