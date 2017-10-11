#threaded implementation of a P0P server

import threading
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

# class for holding sessions
class session():
	def __init__(self, id, addr):
		self.ses_id = id # sessionID choosen by the client
		self.seq_num = 0 
		self.addr = (addr[0], int(addr[1])) # (HOST, PORT) of the client

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
	socket.sendto(message.encode('utf-8'), (clientAddress, clientPort))

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

	#listen for messages on the socket
	while True:
		data, addr = listening.recvfrom(4096)

		# process the data:
		data = bytearray(data)
		
		# check that the magic number and version number are valid. (EXTREMELY HACKY)
		if not ((data[0] == 196) and (data[1] == 97) and (data[2] == 1)):
			continue

		#get the command session id, sequence number
		command = int(data[3])
		ses_id = int(struct.unpack('I', data[8:12])[0])
		seq_num = int(struct.unpack('I', data[4:8])[0])
		message = data[12:].decode("utf-8") #the rest of the message is the data

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
				print("{} [{}] {}".format(sessions[ses_id].ses_id, sessions[ses_id].seq_num, message))
				sessions[ses_id].seq_num += 1

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