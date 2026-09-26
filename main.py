import os
import ast
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="CodeMap AI - Codebase Intelligence Engine")

# Fully open CORS policy to bypass strict local browser connection filters
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
    # Clean up and normalize the user input path for Windows systems
    raw_path = request.path.replace('"', '').replace("'", "").strip()
    target_path = os.path.normpath(raw_path)
    
    if not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="Provided directory path does not exist.")
    
    repo_map = {
        "directory_tree": {},
        "dependencies": []
    }
    
    # Walk through the codebase directory tree structure
    for root, dirs, files in os.walk(target_path):
        # Ignore configuration, dependency, and tracking folders
        if any(ignored in root for ignored in ['.git', 'node_modules', '__pycache__', 'bob_sessions', '.next', 'dist', 'env', 'venv']):
            continue
            
        relative_root = os.path.relpath(root, target_path)
        if relative_root == ".":
            relative_root = "root"
            
        # Only parse actual source development files
        valid_files = [f for f in files if f.endswith(('.py', '.js', '.ts', '.jsx', '.tsx'))]
        if valid_files:
            clean_folder_key = relative_root.replace("\\", "/")
            repo_map["directory_tree"][clean_folder_key] = valid_files
        
        # Analyze imports inside Python files using Abstract Syntax Trees (AST)
        for file in files:
            if file.endswith('.py'):
                full_path = os.path.join(root, file)
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        node = ast.parse(f.read(), filename=file)
                        for item in node.body:
                            if isinstance(item, ast.Import):
                                for name in item.names:
                                    repo_map["dependencies"].append({
                                        "source": file, 
                                        "target": name.name, 
                                        "type": "import"
                                    })
                            elif isinstance(item, ast.ImportFrom) and item.module:
                                repo_map["dependencies"].append({
                                    "source": file, 
                                    "target": item.module, 
                                    "type": "from_import"
                                })
                except Exception:
                    continue

    return repo_map

if __name__ == "__main__":
    import uvicorn
    # Starts the local engine server on port 8000
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
