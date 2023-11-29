import express from "express"
import mongoose, { ConnectOptions } from "mongoose"
import cors from "cors"
import cron from "node-cron"
import http from "http"
import SocketServer from "./socket"
import { Request, Response } from "express"
import 'dotenv/config'

//schedule functions
import { checkOngoingdaremes } from "./controllers/daremeController"
import { checkOngoingfundmes } from "./controllers/fundmeController"
import { setFirstLogin } from "./controllers/authController"

//Routers
import auth from "./Routes/api/auth";
import dareme from "./Routes/api/dareme";
import fundme from "./Routes/api/fundme";
import fanwall from "./Routes/api/fanwall";
import payment from "./Routes/api/payment";
import notification from "./Routes/api/notification";
import transaction from "./Routes/api/transaction";
import tip from "./Routes/api/tip";
import referral from "./Routes/api/referral";

// import DareMe from "./models/DareMe";
// import Option from "./models/Option"

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
const server = http.createServer(app);

const io = SocketServer(server);

app.use((req: Request, res: Response, next) => {
  req.body.io = io
  return next()
});

//DB connection
mongoose.connect(`${process.env.MONGO_URL}`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  } as ConnectOptions)
  .then((res) => {
    console.log("Connected to Mongo DB!!");
  }).catch((err) => console.log(err))

//Routes
app.use("/api/auth", auth)
app.use("/api/dareme", dareme)
app.use("/api/fundme", fundme)
app.use("/api/fanwall", fanwall)
app.use("/api/payment", payment)
app.use("/api/notification", notification)
app.use("/api/transactions", transaction)
app.use("/api/tip", tip)
app.use("/api/referral", referral)
app.use(express.static("public"))

server.listen(PORT, async () => {
  // const daremes: any = await DareMe.find().populate({ path: 'options.option' })
  // for (const dareme of daremes) {
  //   let voteInfo: Array<any> = []
  //   const options = dareme.options
  //   let index = 0
  //   for (const option of options) {
  //     if (option.option.status === 1) {
  //       if (index > 1) {
  //         let filters = voteInfo.filter((vote: any) => (vote.voter + '') === (option.option.writer + ''))
  //         if (filters.length === 0) {
  //           voteInfo.push({ 
  //             voter: option.option.writer,
  //             donuts: option.option.requests ? option.option.requests : 0,
  //             canFree: true,
  //             superfan: false,
  //             transfer: false,
  //           })
  //         } else {
  //           let index = voteInfo.findIndex((vote: any) => (vote.voter + '') === (option.option.writer + ''))
  //           voteInfo[index].donuts += option.option.requests ? option.option.requests : 0
  //         }
  //       }
  //       for (const vote of option.option.voteInfo) {
  //         let filters = voteInfo.filter((vote1: any) => (vote1.voter + '') === (vote.voter + ''))
  //         if (filters.length === 0) {
  //           voteInfo.push({ 
  //             voter: vote.voter,
  //             donuts: vote.donuts,
  //             canFree: vote.canFree,
  //             superfan: vote.superfan,
  //             transfer: vote.transfer
  //           })
  //         } else {
  //           let index = voteInfo.findIndex((vote1: any) => (vote1.voter + '') === (vote.voter + ''))
  //           voteInfo[index].donuts += vote.donuts
  //           if(vote.canFree === false) voteInfo[index].canFree = false
  //           if(vote.superfan === true) voteInfo[index].superfan = true
  //           if(vote.transfer === true) voteInfo[index].transfer = true
  //         }
  //       }
  //     }
  //     index++
  //   }
  //   await DareMe.findByIdAndUpdate(dareme.id, { voteInfo: voteInfo })
  // }
  console.log(`The Server is up and running on PORT ${PORT}`)
})

cron.schedule("*/10 * * * * *", () => checkOngoingdaremes(io))
cron.schedule("*/10 * * * * *", () => checkOngoingfundmes(io))
cron.schedule("59 23 * * *", () => setFirstLogin(), {
  scheduled: true,
  timezone: "Asia/Hong_Kong",
})
