const socketIO = require("socket.io");

const SocketServer = (server: any) => {
  const io = socketIO(server, {
    cors: {
      orgin: "*",
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      preflightContinue: false,
      optionSuccessStatus: 204,
    },
  });

  io.on("connection", (socket: any) => {
    socket.on("connected", (email: any, role: any) => {
      const adminRooms = [email, "ADMIN"];
      const userRooms = [email, "USER"];
      if(role === "ADMIN") socket.join(adminRooms);
      else socket.join(userRooms);
    });
    socket.on('disconnect', () => {});
  });
  return io;
};

export default SocketServer
