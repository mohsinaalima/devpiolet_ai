import os
from langchain_core.tools import tool
from github import Github

@tool
def get_github_file_contents(repo_name: str, file_path: str) -> str:
    """
    Fetches the contents of a specific file from a GitHub repository.
    Use this when you need to read the code to analyze a bug or review a file.
    
    Args:
        repo_name: The full repository name (e.g., 'octocat/Hello-World')
        file_path: The path to the file inside the repo (e.g., 'src/main.py')
    """
    token = os.getenv("GITHUB_ACCESS_TOKEN")
    if not token:
        return "Error: GITHUB_ACCESS_TOKEN is not set."
        
    g = Github(token)
    try:
        repo = g.get_repo(repo_name)
        contents = repo.get_contents(file_path)
        return contents.decoded_content.decode("utf-8")
    except Exception as e:
        return f"Error fetching file: {str(e)}"