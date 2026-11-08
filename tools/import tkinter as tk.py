import tkinter as tk
from tkinter import messagebox, filedialog

def process_text_data(input_text):
    """دالة لمعالجة النص وإرجاع النتيجة بالشكل الجديد المطلوبة"""
    input_text = input_text.strip()
    if not input_text:
        return None
    
    try:
        # تقسيم النص بناءً على الرمز :
        parts = input_text.split(":")
        
        # استخراج الأجزاء المطلوبة
        part1 = parts[0]
        part2 = parts[1]
        
        # التاريخ: 19380401 -> 1938-04-01
        raw_date = parts[2]
        formatted_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
        
        # الرقم
        phone_id = parts[3]
        
        # التجميع بالصيغة الجديدة المطلوبة (باستخدام | بين كل الأجزاء)
        result = f"{part1}|{part2}|{phone_id}|{formatted_date}"
        return result
    except Exception as e:
        raise ValueError(f"خطأ في تنسيق السطر: {e}")

def convert_single():
    """معالجة النص المكتوب يدوياً في خانة الإدخال"""
    input_text = entry_input.get("1.0", tk.END).strip()
    if not input_text:
        messagebox.showerror("خطأ", "الرجاء إدخال النص المراد معالجته!")
        return

    try:
        result = process_text_data(input_text)
        entry_output.delete("1.0", tk.END)
        entry_output.insert(tk.END, result)
    except Exception as e:
        messagebox.showerror("خطأ", f"حدث خطأ:\n{e}")

def open_file():
    """فتح ملف نصي ومعالجة محتواه (يدعم الأسطر المتعددة)"""
    file_path = filedialog.askopenfilename(
        title="اختر ملف النص",
        filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
    )
    if not file_path:
        return

    try:
        with open(file_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
        
        processed_results = []
        for line in lines:
            if line.strip():
                res = process_text_data(line)
                if res:
                    processed_results.append(res)
        
        # عرض النتائج في خانة الإخراج
        entry_output.delete("1.0", tk.END)
        entry_output.insert(tk.END, "\n".join(processed_results))
        messagebox.showinfo("تم بنجاح", f"تمت معالجة {len(processed_results)} سطر من الملف بنجاح!")
        
    except Exception as e:
        messagebox.showerror("خطأ", f"حدث خطأ أثناء قراءة الملف:\n{e}")

def save_file():
    """حفظ النتائج الموجودة في خانة الناتج إلى ملف نصي جديد"""
    output_text = entry_output.get("1.0", tk.END).strip()
    if not output_text:
        messagebox.showerror("خطأ", "لا توجد نتائج لحفظها!")
        return
        
    file_path = filedialog.asksaveasfilename(
        defaultextension=".txt",
        filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")],
        title="حفظ الناتج باسم"
    )
    if file_path:
        try:
            with open(file_path, "w", encoding="utf-8") as file:
                file.write(output_text)
            messagebox.showinfo("تم", "تم حفظ الملف بنجاح!")
        except Exception as e:
            messagebox.showerror("خطأ", f"حدث خطأ أثناء حفظ الملف:\n{e}")

# --- إعداد واجهة المستخدم (Tkinter) ---
root = tk.Tk()
root.title("أداة تنسيق البيانات - Tkinter")
root.geometry("550x450")
root.config(bg="#f0f0f0")

# عنوان النافذة
label_title = tk.Label(root, text="محول بيانات JORGEN المتقدم", font=("Arial", 14, "bold"), bg="#f0f0f0")
label_title.pack(pady=10)

# إطار لأزرار الملفات
frame_files = tk.Frame(root, bg="#f0f0f0")
frame_files.pack(pady=5)

btn_open = tk.Button(frame_files, text="📂 فتح ملف نصي (.txt)", bg="#2196F3", fg="white", font=("Arial", 10, "bold"), command=open_file)
btn_open.pack(side=tk.LEFT, padx=5)

btn_save = tk.Button(frame_files, text="💾 حفظ النتائج كملف", bg="#FF9800", fg="white", font=("Arial", 10, "bold"), command=save_file)
btn_save.pack(side=tk.LEFT, padx=5)

# حقل إدخال النص الأصلي (يدوي)
label_in = tk.Label(root, text="أو أدخل النص يدوياً هنا:", bg="#f0f0f0", anchor="w")
label_in.pack(fill="x", padx=20)

entry_input = tk.Text(root, height=3, font=("Arial", 10))
entry_input.pack(fill="x", padx=20, pady=5)

# زر التحويل اليدوي
btn_convert = tk.Button(root, text="⚡ تحويل النص اليدوي", bg="#4CAF50", fg="white", font=("Arial", 11, "bold"), command=convert_single)
btn_convert.pack(pady=5)

# حقل عرض الناتج
label_out = tk.Label(root, text="الناتج:", bg="#f0f0f0", anchor="w")
label_out.pack(fill="x", padx=20)

entry_output = tk.Text(root, height=6, font=("Arial", 10, "bold"))
entry_output.pack(fill="x", padx=20, pady=5)

# تشغيل التطبيق
root.mainloop()