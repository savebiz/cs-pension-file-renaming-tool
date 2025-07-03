import os
import re
import shutil
from pathlib import Path

# PEN extraction logic
PEN_PATTERNS = [
    re.compile(r'PEN(\d{12})'),
    re.compile(r'_PEN(\d{12})'),
    re.compile(r'^(\d{12})')
]

def extract_pen_number(filename):
    for pattern in PEN_PATTERNS:
        match = pattern.search(filename)
        if match:
            return f'PEN{match.group(1)}'
    return None

def folder_rename_by_pen(root):
    print("\n--- Folder Renaming by PEN ---")
    actions = []
    for dirpath, dirnames, filenames in os.walk(root):
        if dirpath == root:
            continue  # skip root
        pdfs = [f for f in filenames if f.lower().endswith('.pdf')]
        pen_numbers = set()
        for pdf in pdfs:
            pen = extract_pen_number(pdf)
            if pen:
                pen_numbers.add(pen)
        current_folder = os.path.basename(dirpath)
        if len(pen_numbers) == 1:
            pen = list(pen_numbers)[0]
            if current_folder != pen:
                new_dir = os.path.join(os.path.dirname(dirpath), pen)
                actions.append((dirpath, new_dir))
        elif len(pen_numbers) > 1:
            print(f"[SKIP] {dirpath}: Multiple PENs found: {', '.join(pen_numbers)}")
        else:
            print(f"[SKIP] {dirpath}: No PEN found in PDFs")
    if not actions:
        print("No folders to rename.")
        return
    print("\nFolders to be renamed:")
    for old, new in actions:
        print(f"{old} -> {new}")
    if input("\nProceed with renaming? (y/n): ").lower() == 'y':
        for old, new in actions:
            if not os.path.exists(new):
                os.rename(old, new)
                print(f"[RENAMED] {old} -> {new}")
            else:
                print(f"[SKIP] {old}: Target folder {new} already exists.")
    else:
        print("Operation cancelled.")

def file_rename_convention(root):
    print("\n--- File Naming Convention ---")
    actions = []
    for dirpath, dirnames, filenames in os.walk(root):
        for filename in filenames:
            if filename.lower().endswith('.pdf') and '_PEN' in filename:
                parts = filename.split('_PEN')
                if len(parts) == 2:
                    pen_part = 'PEN' + parts[1].replace('.pdf', '')
                    doc_type = parts[0]
                    new_name = f"{pen_part}_{doc_type}.pdf"
                    if new_name != filename:
                        actions.append((os.path.join(dirpath, filename), os.path.join(dirpath, new_name)))
    if not actions:
        print("No files to rename.")
        return
    print("\nFiles to be renamed:")
    for old, new in actions:
        print(f"{old} -> {os.path.basename(new)}")
    if input("\nProceed with renaming? (y/n): ").lower() == 'y':
        for old, new in actions:
            if not os.path.exists(new):
                os.rename(old, new)
                print(f"[RENAMED] {old} -> {os.path.basename(new)}")
            else:
                print(f"[SKIP] {old}: Target file {os.path.basename(new)} already exists.")
    else:
        print("Operation cancelled.")

def pdf_separation_by_pen(root):
    print("\n--- PDF Separation by PEN ---")
    actions = []
    for dirpath, dirnames, filenames in os.walk(root):
        pdfs = [f for f in filenames if f.lower().endswith('.pdf')]
        pen_groups = {}
        for pdf in pdfs:
            pen = extract_pen_number(pdf)
            if pen:
                pen_groups.setdefault(pen, []).append(pdf)
        if len(pen_groups) > 1:
            for pen, files in pen_groups.items():
                pen_folder = os.path.join(dirpath, pen)
                for file in files:
                    src = os.path.join(dirpath, file)
                    dst = os.path.join(pen_folder, file)
                    actions.append((src, dst))
    if not actions:
        print("No PDFs to separate.")
        return
    print("\nPDFs to be moved:")
    for src, dst in actions:
        print(f"{src} -> {dst}")
    if input("\nProceed with moving files? (y/n): ").lower() == 'y':
        for src, dst in actions:
            pen_folder = os.path.dirname(dst)
            os.makedirs(pen_folder, exist_ok=True)
            if not os.path.exists(dst):
                shutil.move(src, dst)
                print(f"[MOVED] {src} -> {dst}")
            else:
                print(f"[SKIP] {src}: Target file already exists.")
    else:
        print("Operation cancelled.")

def main():
    print("CS Pension File Management Tool (Python Edition)")
    root = input("Enter the root directory: ").strip()
    if not os.path.isdir(root):
        print("Invalid directory.")
        return
    print("\nSelect operation:")
    print("1. Folder Renaming by PEN")
    print("2. File Naming Convention")
    print("3. PDF Separation by PEN")
    choice = input("Enter 1, 2, or 3: ").strip()
    if choice == '1':
        folder_rename_by_pen(root)
    elif choice == '2':
        file_rename_convention(root)
    elif choice == '3':
        pdf_separation_by_pen(root)
    else:
        print("Invalid choice.")

if __name__ == "__main__":
    main() 