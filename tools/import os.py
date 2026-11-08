import os
import time
import random
import sys


def clear_screen():
  os.system('cls' if os.name == 'nt' else 'clear')


def matrix_print(text, delay=0.03):
  for char in text:
    sys.stdout.write(char)
    sys.stdout.flush()
    time.sleep(delay)
  print()


def hacker_script():
  # تغيير لون الخط إلى الأخضر الفاتح (يعمل في أنظمة ويندوز ولينكس)
  if os.name == 'nt':
    os.system('color 0A')
  else:
    print('\033[32m', end='')  # لون أخضر للينكس/ماك

  clear_screen()
  matrix_print('INITIALIZING SECURE TERMINAL v4.0.2...')
  time.sleep(0.5)
  matrix_print('ESTABLISHING SECURE CONNECTION TO TARGET SERVERS...')
  time.sleep(1)

  # محاكاة تحميل
  print('\n[+] Bypassing firewall...')
  for i in range(1, 101):
    sys.stdout.write(f'\rProgress: [{i}%] {"#" * (i // 5)}')
    sys.stdout.flush()
    time.sleep(random.uniform(0.01, 0.05))

  print('\n\n[SUCCESS] Access Granted.')
  time.sleep(0.8)
  clear_screen()

  matrix_print('DOWNLOADING TARGET DATA...')
  time.sleep(0.5)

  # محاكاة سحب بيانات وهمية (هيكساديسيمال)
  for _ in range(35):
    line = ''.join(
        random.choice('0123456789ABCDEFabcdef@#$%&*') for _ in range(60)
    )
    print(line)
    time.sleep(0.05)

  print('\n' + '=' * 50)
  matrix_print('CRITICAL: OPERATION COMPLETED SUCCESSFULLY.')
  matrix_print('DISCONNECTING AND WIPING LOGS...')
  time.sleep(1.5)
  print('=' * 50)

  # إعادة اللون للوضع الافتراضي عند الخروج
  if os.name == 'nt':
    os.system('color 07')
  else:
    print('\033[0m', end='')


if __name__ == '__main__':
  try:
    hacker_script()
  except KeyboardInterrupt:
    print('\n\n[!] Session terminated by user.')
    if os.name == 'nt':
      os.system('color 07')
    else:
      print('\033[0m', end='')