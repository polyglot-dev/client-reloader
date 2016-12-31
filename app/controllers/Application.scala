package controllers

import java.nio.file.StandardWatchEventKinds._
import java.nio.file.{Path, Paths}
import javax.inject._

import actors._
import akka.actor._
import akka.stream._
import com.beachape.filemanagement.Messages.EventAtPath
import com.beachape.filemanagement.RxMonitor
import play.api.libs.json._
import play.api.libs.streams._
import play.api.mvc.WebSocket.MessageFlowTransformer
import play.api.mvc._
import rx.lang.scala.Observable

import scala.collection.mutable.ArrayBuffer
import scala.concurrent.duration._

@Singleton
class Application @Inject()(implicit system: ActorSystem, materializer: Materializer) extends Controller {

  val monitor = RxMonitor()
  val eventsToWatch: Observable[EventAtPath] = monitor.observable

  val files_extensions_to_monitor = List(".html", ".css", ".js")

  val currentDir = new java.io.File(".").getCanonicalPath

  val dirToWatch: Path = Paths get currentDir

  val time_to_refresh = 200.milliseconds

  eventsToWatch.
    filter(p =>
      files_extensions_to_monitor.exists(p.path.toString.endsWith _)).
    tumblingBuffer(time_to_refresh).filter(_.nonEmpty).
    subscribe(
      onNext = { l => {

        def extract(suffix: String) = for (
          p <- l;
          str = p.path.toString if str.endsWith(suffix)
        ) yield str.substring(currentDir.length + 1)

        pool foreach (_ ! OutEvent(extract(".html").toSet, extract(".js").toSet, extract(".css").toSet))

      }
      },
      onError = { t => println(t) },
      onCompleted = { () => println("Monitor has been shut down") }
    )

  def registerAllPath(path: Path): Unit = {
    //    monitor.registerPath(ENTRY_CREATE, path)
    monitor.registerPath(ENTRY_MODIFY, path)

    val exclusionsDirs = List("project", ".git", ".idea", "vendor", "target")

    for (f <- path.toFile.listFiles) {
      if (f.isDirectory && !exclusionsDirs.exists(f.getName.equals(_)))
        registerAllPath(Paths get f.getAbsolutePath)
    }
  }

  registerAllPath(dirToWatch)

  val pool: ArrayBuffer[ActorRef] = scala.collection.mutable.ArrayBuffer[ActorRef]()

  case class OutEvent(htmls: Set[String], jss: Set[String], csss: Set[String])

  case class InEvent(a: String)

  implicit val inEventFormat = Json.format[InEvent]

  implicit val outEventFormat = Json.format[OutEvent]

  implicit val messageFlowTransformer = MessageFlowTransformer.jsonMessageFlowTransformer[InEvent, OutEvent]

  def socket: WebSocket = WebSocket.accept[InEvent, OutEvent] { request =>

    ActorFlow.actorRef(out => {
      pool += out
      MyWebSocketActor.props(out)
    })

  }

}
