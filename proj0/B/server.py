#threaded implementation of a P0P server

import threading
import select
import signal
import socket
import sys
import random
import time
import struct

#message types
HELLO = 0
DATA = 1
ALIVE = 2
GOODBYE = 3

#1 means we can keep listening for messages. 0 means send goodbyes and close the socket. 
global state 
state = 1

# class for holding sessions
class session():
	def __init__(self, id, addr):
		self.ses_id = id # sessionID choosen by the client
		self.seq_num = 0 
		self.addr = (addr[0], int(addr[1])) # (HOST, PORT) of the client
		self.last_seen = time.time() #number of seconds since 1970

# create the basic message with no data
def createHeader(seqNum, sesID, command):
	seqNumAsBytes = [chr(seqNum >> i & 0xff) for i in (24,16,8,0)]
	sesIDAsBytes = [chr(sesID >> i & 0xff) for i in (24,16,8,0)]
	message = '\xC4\x61\x01' + chr(command)
	for byte in seqNumAsBytes:
		message += byte
	for byte in sesIDAsBytes:
		message += byte
	return message

#send a message with optional data
def sendMessage(socket, clientPort, clientAddress, seqNum, sesID, command, data = None):
	message = createHeader(seqNum, sesID, command)
	if (data != None):
		# append data
		message = message + data
	# now send the message
	socket.sendto(message, (clientAddress, clientPort))

#sends goodbyes to all sessions
def send_goodbyes(sessions):
	for ses_id in sessions:
		sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, GOODBYE)

#remove all sessions that have been inactive for at least 30 seconds
def cull(sessions):
	for ses_id in list(sessions.keys()): #make a copy of the list of keys so we can remove them dynamically
		if time.time() - sessions[ses_id].last_seen >= 30:
			sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, GOODBYE)
			del sessions[ses_id]

class thread(threading.Thread):

	def __init__(self):
 		super(thread, self).__init__()

	def run(self):
		global state
		while(state != 0):

			try:
				ready = select.select([sys.stdin], [], [], 1)
				if not ready[0]:
 					continue

				line = sys.stdin.readline()

				if not line: #eof
					state = 0
					continue

				if line.replace("\n", "") == "q": #q entered by user
					state = 0

			except KeyboardInterrupt:
				state = 0
				break


if __name__ == "__main__":
	HOST = "0.0.0.0"
	PORT = int(sys.argv[1])

	# number of times the server has sent a message *in any session*
	server_seq_num = 0

	# dictionary for holding all active sessions
	sessions = {}

	#create a socket and bind it to the host and port
	listening = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
	listening.bind((HOST, PORT))
	print("listening on port {}...".format(PORT))
	
	th = thread()
	th.start()

	#listen for messages on the socket
	while state == 1:

		cull(sessions) #remove old sessions

		#if no message is received after 1 second do the loop again
		try:
			ready = select.select([listening], [], [], 1)
		except KeyboardInterrupt:
			state = 0
			break
      
		if not ready[0]:
			continue

		data, addr = listening.recvfrom(4096)

		# process the data:
		data = bytearray(data)
		
		# check that the magic number and version number are valid.
		if not ((data[0] == 196) and (data[1] == 97) and (data[2] == 1)):
			continue

		#get the command session id, sequence number
		command = int(data[3])
		ses_id = int(struct.unpack('>I', data[8:12])[0])
		seq_num = int(struct.unpack('>I', data[4:8])[0])
		message = str(data[12:]) #the rest of the message is the data

		if ses_id in sessions:
			sessions[ses_id].last_seen = time.time()

		if command == 0: #received a hello
			if ses_id not in sessions:
				sessions[ses_id] = session(ses_id, addr)
				print("{} [{}] Session created".format(ses_id, sessions[ses_id].seq_num))
				sessions[ses_id].seq_num += 1

				#send back a hello message
				sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, HELLO)
				server_seq_num += 1

		elif command == 1: #receive data
			if ses_id in sessions:
				diff = int(seq_num) - int(sessions[ses_id].seq_num)
				
				if diff == -1:
					print("duplicate packet")
					continue #print duplicate packet and move on

				elif diff >= 0: #expected number arived
					
					while diff > 1:
						print("lost packet")
						diff -= 1

					print("{} [{}] {}".format(sessions[ses_id].ses_id, sessions[ses_id].seq_num, message))

					sessions[ses_id].seq_num += (1 + diff)

				elif diff < -1: #stored ses_id is greater than received one. Something is wrong, send goodbye.
					sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, GOODBYE)
					server_seq_num += 1

				#send back an alive message
				sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, ALIVE)
				server_seq_num += 1 

		elif command == 3: #received a goodbye
			if ses_id in sessions:
				print("{} [{}] GOODBYE from client.".format(ses_id, sessions[ses_id].seq_num, message))
				sessions[ses_id].seq_num += 1

				#send back a goodbye message
				sendMessage(listening, sessions[ses_id].addr[1], sessions[ses_id].addr[0], server_seq_num, ses_id, GOODBYE)
				server_seq_num += 1
				del sessions[ses_id] #remove the session from active sessions
				print("{} session closed".format(ses_id))

	send_goodbyes(sessions)
	time.sleep(.5) #make sure all goodbyes send?
	th.join()

	#process.exit(0)
