package actors

import akka.actor._

object MyWebSocketActor {
  def props(out: ActorRef) =
    Props(new MyWebSocketActor(out))
}

class MyWebSocketActor(out: ActorRef) extends Actor {

  def receive = {

//    case _ => 0
        case msg => println(msg)

  }

}
