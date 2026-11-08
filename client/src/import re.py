import re
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext


def format_ssn(ssn):
  # تنسيق رقم الـ SSN ليصبح بالشكل: 053-74-4072
  clean_ssn = re.sub(r'\D', '', ssn)
  if len(clean_ssn) == 9:
    return f"{clean_ssn[:3]}-{clean_ssn[3:5]}-{clean_ssn[5:]}"
  return ssn


def process_text(input_text):
  output_lines = []
  lines = input_text.strip().split('\n')

  for line in lines:
    if not line.strip():
      continue

    # استخراج الاسم الأول والأخير
    fullname_match = re.search(r'FULLNAME\s*=\s*([^|]+)', line)
    dob_match = re.search(r'dateOfBirth\s*=\s*([^|]+)', line)
    ssn_match = re.search(r'ssn\s*=\s*([^|]+)', line)

    if fullname_match and dob_match and ssn_match:
      fullname = fullname_match.group(1).strip()
      dob = dob.group(1).strip() if (dob := dob_match) else ''
      raw_ssn = ssn_match.group(1).strip()

      # تقسيم الاسم الكامل إلى جزأين (الأول والأخير)
      name_parts = fullname.split()
      first_name = name_parts[0] if len(name_parts) > 0 else ''
      last_name = name_parts[-1] if len(name_parts) > 1 else ''

      formatted_ssn = format_ssn(raw_ssn)

      # النتيجة بالشكل المطلوب
      result_line = f'{first_name}|{last_name}|{formatted_ssn}|{dob}'
      output_lines.append(result_line)

  return '\n'.join(output_lines)


def browse_file():
  file_path = filedialog.askopenfilename(
      filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
  )
  if file_path:
    try:
      with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()
        input_area.delete("1.0", tk.END)
        input_area.insert(tk.END, content)
    except Exception as e:
      messagebox.showerror("خطأ", f"تعذر قراءة الملف:\n{e}")


def convert_data():
  input_data = input_area.get("1.0", tk.END)
  if not input_data.strip():
    messagebox.showwarning("تنبيه", "الرجاء إدخال أو تحميل بيانات أولاً!")
    return

  result = process_text(input_data)
  output_area.delete("1.0", tk.END)
  output_area.insert(tk.END, result)


def save_file():
  result_data = output_area.get("1.0", tk.END)
  if not result_data.strip():
    messagebox.showwarning("تنبيه", "لا توجد نتائج لحفظها!")
    return

  file_path = filedialog.asksaveasfilename(
      defaultextension=".txt",
      filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")],
  )
  if file_path:
    try:
      with open(file_path, "w", encoding="utf-8") as file:
        file.write(result_data)
      messagebox.showinfo("نجاح", "تم حفظ الملف بنجاح!")
    except Exception as e:
      messagebox.showerror("خطأ", f"تعذر حفظ الملف:\n{e}")


# --- تصميم الواجهة الرسومية (GUI) ---
root = tk.Tk()
root.title("أداة تنسيق البيانات - Tkinter")
root.geometry("750x600")
root.config(bg="#f0f0f0")

# عنوان رئيسي
title_label = tk.Label(
    root,
    text="محول بيانات الملفات إلى الصيغة المطلوبة",
    font=("Arial", 14, "bold"),
    bg="#f0f0f0",
    fg="#333",
)
title_label.pack(pady=10)

# إطار الإدخال
frame_input = tk.Frame(root, bg="#f0f0f0")
frame_input.pack(fill=tk.BOTH, expand=True, padx=15, pady=5)

lbl_input = tk.Label(
    frame_input, text="النص أو الملف الأصلي:", bg="#f0f0f0", font=("Arial", 10)
)
lbl_input.pack(anchor="w")

input_area = scrolledtext.ScrolledText(
    frame_input, height=10, font=("Consolas", 10)
)
input_area.pack(fill=tk.BOTH, expand=True, pady=5)

# أزرار التحكم
btn_frame = tk.Frame(root, bg="#f0f0f0")
btn_frame.pack(pady=10)

btn_browse = tk.Button(
    btn_frame,
    text="📂 تحميل ملف",
    command=browse_file,
    bg="#4CAF50",
    fg="white",
    font=("Arial", 10, "bold"),
    padx=10,
    pady=5,
)
btn_browse.grid(row=0, column=0, padx=5)

btn_convert = tk.Button(
    btn_frame,
    text="⚙️ تحويل البيانات",
    command=convert_data,
    bg="#2196F3",
    fg="white",
    font=("Arial", 10, "bold"),
    padx=10,
    pady=5,
)
btn_convert.grid(row=0, column=1, padx=5)

btn_save = tk.Button(
    btn_frame,
    text="💾 حفظ النتيجة",
    command=save_file,
    bg="#FF9800",
    fg="white",
    font=("Arial", 10, "bold"),
    padx=10,
    pady=5,
)
btn_save.grid(row=0, column=2, padx=5)

# إطار الإخراج
frame_output = tk.Frame(root, bg="#f0f0f0")
frame_output.pack(fill=tk.BOTH, expand=True, padx=15, pady=5)

lbl_output = tk.Label(
    frame_output, text="النتيجة النهائية:", bg="#f0f0f0", font=("Arial", 10)
)
lbl_output.pack(anchor="w")

output_area = scrolledtext.ScrolledText(
    frame_output, height=10, font=("Consolas", 10)
)
output_area.pack(fill=tk.BOTH, expand=True, pady=5)

# تشغيل التطبيق
root.mainloop()