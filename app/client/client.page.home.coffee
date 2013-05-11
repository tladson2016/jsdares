applet = require("../jsmm-applet")
dares = require("../dares")

module.exports = (client) ->
  class client.PageHome
    type: "PageHome"

    constructor: (delegate, $div) ->
      @delegate = delegate
      @$div = $div

      @$aboutText = $("<div class=\"homepage-title\">Make your own <strong>games</strong> by learning <strong>JavaScript</strong> programming!</div><p class=\"homepage-about-text\"><strong>jsdares</strong> is an open source proof-of-concept. <a href=\"/blindfold\" class=\"homepage-blindfold-link\">Learn more&hellip;</a><span></p>")
      @$aboutText.find(".homepage-blindfold-link").on "click", (e) =>
        e.preventDefault()
        @delegate.navigateTo "/blindfold"
      @$div.append @$aboutText

      @modalUI = new applet.UI
      @modalUI.setCloseCallback _(@closeCallback).bind(this)

      @$example = $("<div class=\"example\"></div>")
      @$div.append @$example

      @exampleUI = new applet.UI @$example, hideTabs: true
      exampleText = "// Adapted from billmill.org/static/canvastutorial\n// This code is still relatively complicated -- if you\n// can come up with a nice game for on the front page\n// which is fun, simple, and shows off the capabilities\n// of the interface, then contact me at jp@jsdares.com :)\n\nvar context = canvas.getContext(\"2d\");\n\nvar bricks = [];\nvar paddleWidth, paddleHeight, bricksNumX, bricksNumY;\nvar brickWidth, brickHeight, brickMargin, paddleX;\nvar ballX, ballY, ballVx, ballVy, ballDirx, ballDiry;\nvar restart = true;\n\nfor (var y=0; y<20; y++) {\n  bricks[y] = [];\n  for (var x=0; x<20; x++) {\n    bricks[y][x] = true;\n  }\n}\n\nfunction setValues() {\n  paddleWidth = 80;\n  paddleHeight = 12;\n  bricksNumX = 7;\n  bricksNumY = 5;\n  brickWidth = canvas.width / bricksNumX;\n  brickHeight = 20;\n  brickMargin = 4;\n  ballVx = 7;\n  ballVy = 12;\n}\n\nfunction init() {\n  restart = false;\n  paddleX = canvas.width/2;\n  ballX = 40;\n  ballY = 150;\n  ballDirx = 1;\n  ballDiry = 1;\n  for (var y=0; y<13; y++) {\n    for (var x=0; x<13; x++) {\n      bricks[y][x] = true;\n    }\n  }\n}\n\nfunction clear() {\n  context.clearRect(0, 0, canvas.width, canvas.height);  \n}\n\nfunction circle(x, y) {\n  context.beginPath();\n  context.arc(x, y, 10, 0, 2*Math.PI);\n  context.fill();\n}\n\nfunction drawPaddle() {\n  var x = paddleX - paddleWidth/2;\n  var y = canvas.height - paddleHeight;\n  context.fillRect(x, y, paddleWidth, paddleHeight);\n}\n\nfunction mouseMove(event) {\n  paddleX = event.layerX;\n}\n\nfunction hitHorizontal() {\n  if (ballX < 0) {\n    ballDirx = -ballDirx;\n  } else if (ballX >= canvas.width) {\n    ballDirx = -ballDirx;\n  }\n}\n\nfunction hitVertical() {\n  if (ballY < 0) {\n    ballDiry = -ballDiry;\n  } else if (ballY < brickHeight*bricksNumY) {\n    var bx = Math.floor(ballX/brickWidth);\n    var by = Math.floor(ballY/brickHeight);\n    \n    if (bx >= 0 && bx < bricksNumX) {\n      if (bricks[by][bx]) {\n        bricks[by][bx] = false;\n        ballDiry = -ballDiry;\n      }\n    }\n  } else if (ballY >= canvas.height-paddleHeight) {\n    var paddleLeft = paddleX-paddleWidth/2;\n    var paddleRight = paddleX+paddleWidth/2;\n    if (ballX >= paddleLeft && ballX <= paddleRight) {\n      ballDiry = -ballDiry;\n    } else {\n      restart = true;\n      return false;\n    }\n  }\n  return true;\n}\n\nfunction drawBricks() {\n  for (var by=0; by<bricksNumY; by++) {\n    for (var bx=0; bx<bricksNumX; bx++) {\n      if (bricks[by][bx]) {\n        var x = bx * brickWidth + brickMargin/2;\n        var y = by * brickHeight + brickMargin/2;\n        var width = brickWidth - brickMargin;\n        var height = brickHeight - brickMargin;\n        context.fillRect(x, y, width, height);\n      }\n    }\n  }\n}\n\nfunction tick() {\n  if (restart) {\n    init();\n    return;\n  }\n  setValues();\n  clear();\n  drawPaddle();\n  \n  ballX += ballVx*ballDirx;\n  ballY += ballVy*ballDiry;\n  \n  hitHorizontal();\n  if (hitVertical()) {\n    circle(ballX, ballY);\n    drawBricks();\n  } else {\n    clear();\n  }\n}\n\ncanvas.onmousemove = mouseMove;\nwindow.setInterval(tick, 30);"
      @exampleEditor = @exampleUI.addEditor text: exampleText
      @exampleUI.loadOutputs
        canvas:
          enabled: true
        events:
          enabled: true
          mouseObjects: ["canvas"]
        math:
          enabled: true
      @exampleUI.selectTab "canvas"

      $(".example-text-top").css "margin-left", -$(".example-text-top").width() / 2
      $(".example-text-bottom").css "margin-left", -$(".example-text-bottom").width() / 2
     
      @$how = $("<div class=\"how\"><div class=\"how-header\">Getting started</div><div class=\"how-text\"><div class=\"how-text-1\">You learn programming by completing <strong>dares</strong>. These are short puzzles in which you have to copy the example, in as few lines of code as possible. They start simple, and become more difficult as you progress.</div><div class=\"how-text-2\"><!-- Get started with learning the <strong>basics</strong> of programming. If you already know some programming, you can take an <strong>interface</strong> crash course. Or just <strong>discover</strong> all the dares! --> For now we only provide a number of <strong>examples</strong>. In the future we will provide some collections of dares to start with, and you will also be able to make and share your own dares. You can also play around in the <strong>full editor</strong>.</div></div></div>")
      @$div.append @$how

      @$intro = $("<div class=\"intro\"></div>")
      @$arrow = $("<div class=\"arrow arrow-left arrow-animate-infinity intro-arrow\"><div class=\"arrow-head\"></div><div class=\"arrow-body\"></div></div>")
      @$intro.append @$arrow
      @$arrow.hide()

      $collection1 = $("<div class=\"intro-collection1\"></div>")
      @collection1 = new dares.Collection(this, $collection1)
      @$intro.append $collection1

      $collection2 = $("<div class=\"intro-collection2\"></div>")
      @collection2 = new dares.Collection(this, $collection2)
      @$intro.append $collection2

      @$introButton = $("<button class=\"intro-full-editor btn btn-large\">Open full editor</button>")
      @$introButton.on "click", (event) =>
        @delegate.navigateTo "/full"
      @$intro.append @$introButton
      @$div.append @$intro

      @fullEditor = null
      @updateCollections()

    remove: ->
      @$aboutText.remove()
      @exampleUI.remove()
      @collection1.remove()
      @collection2.remove()
      @$example.remove()
      @$how.remove()
      @$intro.remove()

    getSync: ->
      @delegate.getSync()

    viewDare: (_id) ->
      @delegate.navigateTo "/dare/" + _id

    editDare: (_id) ->
      @delegate.navigateTo "/edit/" + _id

    updateCollections: ->
      @delegate.getSync().getCollectionAndDaresAndInstances "5009684ce78955fbcf405844", (content) =>
        @collection1.update content, @delegate.getUserId(), @delegate.getAdmin()
        if !content.dares[0].instance || !content.dares[0].instance.completed
          @$arrow?.show()

      @delegate.getSync().getCollectionAndDaresAndInstances "30000000078955fbcf405844", (content) =>
        @collection2.update content, @delegate.getUserId(), @delegate.getAdmin()

    closeCallback: ->
      @delegate.navigateTo "/"

    navigateTo: (splitUrl) ->
      if @$arrow? && splitUrl[0] != ""
        @$arrow.remove()
        @$arrow = null
      if splitUrl[0] == "dare" || splitUrl[0] == "edit"
        @exampleEditor.disable()
        @closeModal()
      else if splitUrl[0] == "full"
        @exampleEditor.disable()
        @navigateFullEditor()
      else
        @exampleEditor.enable()
        @closeModal()
        @updateCollections()

    navigateFullEditor: ->
      if localStorage.getItem("initial-code") is null
        localStorage.setItem "initial-code", "// ROBOT EXAMPLE\nwhile(!robot.detectGoal()) {\n  robot.turnLeft();\n  while (robot.detectWall()) {\n    robot.turnRight();\n  }\n  robot.drive();\n}\n\n//CONSOLE EXAMPLE\nconsole.setColor(\"#fff\");\nconsole.log(\"A colourful multiplication table:\");\nconsole.log();\n\nfunction printLine(n) {\n  var text = \"\";\n  for (var i=1; i<=8; i++) {\n    text += (i*n) + \"\\t\";\n  }\n  console.log(text);\n}\n\nfor (var i=1; i<=20; i++) { \n  console.setColor(\"hsla(\" + i*15 + \", 75%, 50%, 1)\");\n  printLine(i);\n}\n\nconsole.setColor(\"#ed7032\");\nconsole.log();\nconsole.log(\":-D\");\n\n"

      if localStorage.getItem("initial-robot") is null
        localStorage.setItem "initial-robot", "{\"columns\":8,\"rows\":8,\"initialX\":3,\"initialY\":4,\"initialAngle\":90,\"mazeObjects\":50,\"verticalActive\":[[false,false,false,false,false,false,false,false],[false,false,true,true,true,false,true,false],[false,true,false,false,true,false,false,true],[false,false,true,true,false,false,true,false],[false,true,true,false,false,false,false,false],[false,false,false,true,false,true,true,false],[false,false,true,false,true,true,false,false],[false,false,false,true,true,true,true,false]],\"horizontalActive\":[[false,true,false,false,true,false,false,true],[false,true,false,true,false,false,true,false],[false,true,true,false,true,false,true,false],[false,true,false,false,true,true,true,false],[false,false,true,true,false,true,false,true],[false,true,false,false,true,false,false,true],[false,true,true,true,false,false,false,true],[false,true,true,false,false,false,false,false]],\"blockGoal\":[[false,false,false,true,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false],[false,false,false,false,false,false,false,false]],\"numGoals\":1}"
      
      @modalUI.openModal()
      @fullEditor = @modalUI.addEditor text: localStorage.getItem("initial-code")
      @fullEditor.setTextChangeCallback (text) ->
        localStorage.setItem "initial-code", text

      @modalUI.loadOutputs
        robot:
          enabled: true
          state: localStorage.getItem("initial-robot")
        canvas:
          enabled: true
        console:
          enabled: true
        info:
          enabled: true
        events:
          enabled: true
          mouseObjects: ["canvas"]
        math:
          enabled: true

      @modalUI.getOutput("robot").setStateChangeCallback (state) ->
        localStorage.setItem "initial-robot", state

      @modalUI.selectTab "robot"

    closeModal: ->
      if @fullEditor?
        @fullEditor = null
        @modalUI.closeModal()
