#!/usr/bin/python

import tempfile
import os
import sys
from time import sleep
import sys, select
import time

# open a tmp file for the data
f = tempfile.NamedTemporaryFile(delete=False)

datacnt=0
done = 0
while not done:
  f.write(str(int(time.time())) + "," + str(datacnt) +"\n")
  datacnt += 1
  i, o, e = select.select( [sys.stdin], [], [], 1 )
  line = ""
  if (i):
    line = sys.stdin.readline().strip()
  if line == "STOP":
    done = 1
    break

f.close()
print("SAMPLE_SENSOR\t" + f.name + "\tJust some random data. datacnt of them")
