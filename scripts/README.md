# Local API runner

Use these scripts to run the API without Visual Studio.

## First setup

Run once if HTTPS is not configured:

```powershell
dotnet dev-certs https --trust
```

## Commands

```powershell
.\scripts\run-api.cmd
```

Builds the API, stops the previous script-started API process, and starts Kestrel in the background.

```powershell
.\scripts\stop-api.cmd
```

Stops the background API process.

```powershell
.\scripts\build-api.cmd
```

Stops the API and builds the project.

The runner writes temporary files to `artifacts/`.

Swagger:

```text
https://localhost:7219/swagger
```
