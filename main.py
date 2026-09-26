import os
import ast
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CodeMap AI - Codebase Intelligence Engine")

# Fully open CORS policy to allow browser testing across all local ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RepoRequest(BaseModel):
    path: str

@app.get("/")
def read_root():
    return {"status": "online", "engine": "IBM Bob 2.0 Agent Integrator", "project": "CodeMap AI"}

@app.post("/api/analyze-structure")
def analyze_structure(request: RepoRequest):
    """
    Recursively scans a target directory path to map file architecture
    and extract internal module dependency patterns.
    """
    raw_path = request.path.replace('"', '').replace("'", "").strip()
    target_path = os.path.normpath(raw_path)
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="Provided directory path does not exist.")
    
    repo_map = {
        "directory_tree": {},
        "dependencies": []
    }
    
    for root, dirs, files in os.walk(target_path):
        if any(ignored in root for ignored in ['.git', 'node_modules', '__pycache__', 'bob_sessions', '.next', 'dist', 'env', 'venv']):
            continue
            
        relative_root = os.path.relpath(root, target_path)
        if relative_root == ".":
            relative_root = "root"
            
        valid_files = [f for f in files if f.endswith(('.py', '.js', '.ts', '.jsx', '.tsx'))]
        if valid_files:
            clean_folder_key = relative_root.replace("\\", "/")
            repo_map["directory_tree"][clean_folder_key] = valid_files
        
        for file in files:
            if file.endswith('.py'):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        node = ast.parse(f.read(), filename=file)
                        for item in node.body:
                            if isinstance(item, ast.Import):
                                for name in item.names:
                                    repo_map["dependencies"].append({"source": file, "target": name.name, "type": "import"})
                            elif isinstance(item, ast.ImportFrom) and item.module:
                                repo_map["dependencies"].append({"source": file, "target": item.module, "type": "from_import"})
                except Exception:
                    continue

    return repo_map

@app.post("/api/generate-readme")
def generate_readme(request: RepoRequest):
    """
    Simulates the AI subagent synthesis flow to compile an advanced structural
    onboarding instruction asset for the target codebase.
    """
    raw_path = request.path.replace('"', '').replace("'", "").strip()
    target_path = os.path.normpath(raw_path)
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="Invalid target path.")

    markdown_content = (
        f"# 🚀 Automated Developer Onboarding Guide\n\n"
        f"Welcome to the project! This documentation was autonomously synthesized by **CodeMap AI** using **IBM Bob 2.0 Engine Proximity Traces**.\n\n"
        f"## 📁 Repository Overview\n"
        f"- **Target Root Path:** `{target_path}`\n"
        f"- **Primary Architecture Style:** Multi-tier Core Architecture\n\n"
        f"## ⚙️ Accelerated Onboarding Steps\n"
        f"1. **Environment Setup:** Copy any generated `.env.example` configurations to your active runtime root.\n"
        f"2. **Dependency Verification:** Inspect the file mappings panel to confirm cross-module system bridges are working cleanly.\n"
        f"3. **Local Dev Standup:** Spin up runtime microservices using native execution controls.\n\n"
        f"## 🧠 Architecture Insights\n"
        f"System modules communicate through decoupled API networks. Ensure your local firewalls do not step on active communication ports.\n"
    )
    
    return {"markdown": markdown_content}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
