# threaded implementation of a P0P client

import threading
import select
import signal
import socket
import sys
import random
import time

def createHeader(seqNum, sesID, command):
  seqNumAsBytes = [chr(seqNum >> i & 0xff) for i in (24,16,8,0)]
  sesIDAsBytes = [chr(sesID >> i & 0xff) for i in (24,16,8,0)]

  message = '\xC4\x61\x01' + chr(command)

  for byte in seqNumAsBytes:
    message += byte
  for byte in sesIDAsBytes:
    message += byte

  return message

def sendMessage(socket, clientPort, clientAddress, seqNum, sesID, command,
  data = None):

  message = createHeader(seqNum, sesID, command)

  if (data != None):
    # append data
    message = message + data

  # now send the message
  socket.sendto(message, (clientAddress, clientPort))

# take in the address and port from command line
address = sys.argv[1]
port = int(sys.argv[2])

# create a UDP socket for sending and receiving
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# store data about the session
seqNum = 0
sesID = random.randint(0, (2<<31))

# save vars for message type
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3

# initialize state at 0 -- HELLO WAIT
# state map: [-2, -1, 0, 1, 2] = [CLOSED, CLOSING, HELLO WAIT,
  # READY, READY TIMER]
state = 0

# define our timeout handler
def timeoutHandler():
  global state
  if state > -1:
    # if we timeout in any states before closing, go to closing
    state = -1
  else:
    # else, go to closed
    state = -2

class timeout:
  def __init__(self, active, timeout_time):
    self.active = active
    self.timeout_time = timeout_time

  def check(self):
    if (self.active and time.time() > self.timeout_time):
      timeoutHandler()

  def activate(self, delta_t = 30):
    if not self.active:
      self.active = True
      self.timeout_time = time.time() + 30

  def deactivate(self):
    self.active = False

to = timeout(True, time.time() + 30)

# start our listener thread waiting for a response
class thread(threading.Thread):
  def __init__(self, sock, to):
    super(thread, self).__init__()
    self.sock = sock
    self.to = to

  def run(self):
    global state
    while (state > -2):
      # check for timeout
      self.to.check()

      # block for at most a second
      ready = select.select([self.sock], [], [], 1)
      if not ready[0]:
        continue
      # input is ready
      data, servAddress = self.sock.recvfrom(4096)

      # deactive the timeout
      self.to.deactivate()

      # process the data:
      header = bytearray(createHeader(seqNum, sesID, HELLO))
      data = bytearray(data)

      # first of all, first 3 bytes should match correct header
      if (data[0:3] != header[0:3]):
        continue

      # last 4 bytes should match (ses id)
      if (data[8:12] != header[8:12]):
        continue

      # sequence number should be <= seqNum:
      if (data[4:8] > header[4:8]):
        continue

      # now save command:
      command = int(data[3])

      # now handle what type of input it is
      if (state == 0 and command == HELLO):
        # we've been waiting for a hello!; transition to ready
        state = 1
      elif (state == 2 and command == ALIVE):
        # we've been waiting for a response!; transition to ready
        state = 1
      elif (command == GOODBYE):
        # we got a goodbye!; transition to closed
        state = -2

th = thread(sock, to)
th.start()

# send hello
sendMessage(sock, port, address, seqNum, sesID, HELLO)
seqNum += 1
to.activate()

# wait for a response; if we get one, the other thread will
# change our state for us
try:
  while (state == 0):
    time.sleep(0.01)
except KeyboardInterrupt:
  state = -2

while (state > -1):
  # we're not in closing or closed - hence wait for input
  try:
    ready = select.select([sys.stdin], [], [], 1)
    if not ready[0]:
      continue
    line = sys.stdin.readline()
  except KeyboardInterrupt:
    state = -2
    break

  if not line:
    # ctrl-d
    state = -1
    break

  # now we have a line of input, send it off in a message
  state = 2
  sendMessage(sock, port, address, seqNum, sesID, DATA, line[:-1])
  seqNum += 1
  # activate the timeout:
  to.activate()

if (state == -1):
  # closing state
  sendMessage(sock, port, address, seqNum, sesID, GOODBYE)
  to.activate()

# we're done! join up the thread!
try:
  th.join()
except KeyboardInterrupt:
  state = -2

th.join()
