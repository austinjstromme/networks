import server
import thread

HOST = "127.0.0.1"
PORT = 33333

#create a socket and bind it to the host and port
listening = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
listening.bind((HOST, PORT))

while True:
	data, addr = listening.recvfrom(12)
	print(data)