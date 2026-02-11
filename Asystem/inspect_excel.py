
import pandas as pd

file_path = "d:\\2025\\AI\\MongoDB\\Asystem\\asys_aws_移行log改寫清單.xlsx"

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head())
except Exception as e:
    print(f"Error reading file: {e}")
