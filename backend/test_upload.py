import requests
import json

res = requests.post("http://localhost:8000/admin/upload", files={"file": ("valid_test.docx", open("valid_test.docx", "rb"))})
print(res.status_code)
try:
    print(res.json())
except:
    print(res.text)
