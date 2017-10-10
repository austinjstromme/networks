# threaded implementation of a P0P client

import threading
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

  print("seqNum == " + str(seqNum))

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
global state
state = 0

# define our timeout handler
def timeoutHandler():
  if state > -1:
    # if we timeout in any states before closing, go to closing
    state = -1
  else:
    # else, go to closed
    state = -2

# register timeoutHandler
signal.signal(signal.SIGALRM, timeoutHandler)
# set timeout for 30s
signal.alarm(30)

# start our listener thread waiting for a response
class thread(threading.Thread):
  def __init__(self, sock):
    super(thread, self).__init__()
    self.sock = sock

  def run(self):
    global state
    while (state > -2):
      data, servAddress = self.sock.recvfrom(4096)
      # need to add in a process message componenet here to
      # deal with the fact that the seqNums won't quite be right
      # kill the alarm
      signal.alarm(0)
      # now handle what type of input it is
      if (state == 0 and data == createHeader(seqNum, sesID, HELLO)):
        # we've been waiting for a hello!; transition to ready
        state = 1
      elif (state == 2 and data == createHeader(seqNum, sesID, ALIVE)):
        # we've been waiting for a response!; transition to ready
        state = 1
      elif (data == createHeader(seqNum, sesID, GOODBYE)):
        # we got a goodbye!; transition to closed
        state = -2

th = thread(sock)
th.start()

# send hello
sendMessage(sock, port, address, seqNum, sesID, HELLO)
seqNum += 1

while (state > -1):
  # we're not in closing or closed - hence wait for input
  try:
    line = sys.stdin.readline()
  except KeyboardInterrupt:
    state = -2
    break
  if not line:
    # ctrl-d
    state = -1
    break

  # now we have a line of input, send it off in a message
  signal.alarm(30)
  state = 2
  sendMessage(sock, port, address, seqNum, sesID, DATA, line[:-1])
  seqNum += 1

if (state == -1):
  # closing state
  # now we're in closing; send a goodbye then wait
  # for a goodbye or for timeout
  sendMessage(sock, port, address, seqNum, sesID, GOODBYE)
  signal.alarm(30)

# we're done! join up the thread!
th.join()
