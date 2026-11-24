# MeFriend Applications Portal

This repository is the SharePoint Framework (SPFx) frontend for the MeFriend Applications Portal. The portal launches the MeFriend BC Extension and Business Performance Tracker as separate applications.

## Architecture

```text
SPFx web part
  portal/                       application launcher, registry, top-level routes
  shared/                       UI, layout, design tokens, context contracts,
                                API/auth transport, SharePoint REST, utilities
  applications/
    bc-extension/               BC pages, internal routes, services, models,
                                permissions, requests, approvals, configuration
    business-performance-tracker/  performance, collection, invoice, and cheque pages
```

Shared code never imports an application. The portal imports application definitions only through [the central registry](src/webparts/mefrienddynamics/portal/config/applications.ts). Portal routing selects an application prefix; the selected application resolves and navigates its own pages. The same registry supplies launcher cards, route metadata, and enabled status. Business Performance Tracker currently reuses several BC Extension company, access, salesperson, and invoice helpers; its own invoice model and print template are kept within its application folder to avoid changing BC behavior.

The SPFx entry point is `src/webparts/mefrienddynamics/MefrienddynamicsWebPart.ts`. It passes the signed-in user and SPFx clients to the React portal. Generic controls, hooks, models, API transport, authentication, SharePoint REST access, formatting, and design foundations live under `src/webparts/mefrienddynamics/shared/`. Business Central endpoints, SharePoint list schemas, access rules, workflow, and page logic remain under `src/webparts/mefrienddynamics/applications/bc-extension/`.

The BC application opens at `#/apps/bc`; Business Performance Tracker opens at `#/apps/business-performance`. The launcher opens at `#/` or `#/apps`. Hash routes keep SharePoint page refreshes on the same page. The BC application definition supplies legacy bookmark roots so old BC hashes can migrate without BC-specific logic in the portal router.

To add another application, create `src/webparts/mefrienddynamics/applications/<name>/` with its own component, pages, internal routes, services, models, and access source. Export one application definition from its `index.ts`, then add that definition to the central registry. The new module can import shared UI and infrastructure immediately; it does not need changes to the BC module. See [the platform guide](docs/portal-platform.md) for the application contract and development steps.

## Repository layout

```text
config/                   SPFx build and package configuration
docs/                     platform, integration, implementation, deployment notes
src/webparts/mefrienddynamics/
  portal/                 portal shell and application registry
  shared/                 reusable platform code
  applications/           independent application modules
  components/             SPFx-facing React adapter
  MefrienddynamicsWebPart.ts
teams/                    Teams icons used by the SPFx package
sharepoint/solution/      generated package output (Git ignored)
mefriend-api/             local backend build artifacts; API source is not tracked here
```

The BC frontend calls its configured backend through the shared API client. Business Central authentication and Business Central API calls belong on the server side; the frontend must not contain BC client secrets or request BC OAuth tokens. [API contract notes](docs/api-contract-status.md) and [backend deployment guidance](docs/deployment.md) document that integration. They do not imply that a .NET API source project is included in this Git repository.

## Build and verification

Use Node.js `>=22.14.0 <23.0.0`. From the repository root, run `npm ci` to install dependencies and `npm run build` to compile, lint, and package the SPFx solution. The generated package is `sharepoint/solution/madhyamam-mefriend.sppkg` and is ignored by Git. Building or packaging does not publish the solution.

Business Performance Tracker expects the SharePoint lists named in `applications/business-performance-tracker/config/sharePointConfig.ts`, plus `Business Performance App User Permissions`, `Business Performance Unit Access`, `Business Performance Cheque Entries`, and the existing `MeFriend App Users` list. It uses the existing SharePoint site URL in its `config/appConfig.ts`. Its invoices use the BC backend URL from the BC Extension configuration. The Business Report, Collection Vertical Report, and Collection on Bills API services are enabled only in local SPFx debug mode and still point to a localhost backend. Provision the lists and backend separately before functional testing; this repository contains only the frontend.

Before release, verify both launcher entries, BC module navigation, permissions, approval flows, requests, Business Central integration, detail-page refreshes, legacy bookmarks, and the Business Performance Tracker modules in a SharePoint test site. Compilation does not replace those functional checks. The package must be reviewed and deployed through the approved SharePoint process; no deployment is performed by the build command.

## Integration provenance

Business Performance Tracker source was copied from `shahadmdm/MeFriend`, branch `feature/collection-vertical-report`, commit `ef0f038bb7ea8b826c8f33a053a757a814e234cc`. The portal registry was adapted and its invoice types, print template, and financial helpers were localized to the new application; two additive pagination exports were added to shared code. No existing BC Extension source file was replaced. The linked source repository did not contain a license file, so confirm redistribution terms with its owner before reuse outside this project. This integration and its compatibility edits were AI assisted; the application features themselves came from the linked team repository.

## Git workflow

Develop changes on a focused feature branch, review the working tree, and stage only the files belonging to that change. A typical local sequence is:

```bash
git status --short
git switch -c feature/<short-description>
npm run build
git diff --check
git diff --stat
git add <reviewed-paths>
git commit -m "Describe the change"
```

Push the branch to the approved remote and open a review request only after the destination is confirmed. Keep portal changes in `portal/`, reusable code in `shared/`, and business code in `applications/<name>/` so reviews preserve the dependency boundary. Avoid force pushes, history rewrites, destructive resets, and broad staging that captures unrelated local changes.

Commit source, configuration, documentation, and intentional assets. Do not commit `node_modules`, `lib`, `dist`, `temp`, `release`, `sharepoint/solution`, `.sppkg` files, generated styles, local credential caches, secrets, or tokens; [`.gitignore`](.gitignore) covers the main generated paths. Review `config/package-solution.json` when preparing a release and change the package version only as required by the release process.
