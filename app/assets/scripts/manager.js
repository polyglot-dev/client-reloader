'use strict'

var websocket = new WebSocket('ws://localhost:9000/ws')

websocket.onopen = function (evt) {
    console.log("open")
}

websocket.onclose = function (evt) {
    console.log("close")
}

websocket.onmessage = function (evt) {
    console.log(evt.data)

    var res = JSON.parse(evt.data)
    reload(res.htmls, res.jss, res.csss)
}

websocket.onerror = function (evt) {
    console.log("error")
}

function slugify(path) {
    return path.replace(/[\/ .]/g, '-')
}

function log(msg) {
    // console.log(msg)
}

function reload_node(elementType, parent, pairs) {
    $("#" + pairs.id).remove()
    var s = document.createElement(elementType)
    _.assign(s, pairs)

    return Rx.Observable.create(function (observer) {

        function func() {
            s.removeEventListener('load', func, false)
            observer.onCompleted()
        }

        s.addEventListener('load', func, false)

        log("Reloading " + elementType + ": " + pairs.id)

        parent.appendChild(s)

    })
}

function reload_script(path) {
    return reload_node("script", document.head, {
        id: slugify(path),
        type: 'text/javascript',
        charset: 'utf-8',
        // async: true,
        src: path
    })
}

function reload_css(path) {
    return reload_node("link", document.head, {
        id: slugify(path),
        type: 'text/css',
        charset: 'utf-8',
        // async: true,
        rel: "stylesheet",
        href: path
    })
}


function reload(templates, scripts, styles) {
    function resetSammy() {
        sammyConfig.unload()
        // sammyConfig.bind_routes()
        sammyConfig.run()
    }

    _.forEach(_.keys(pages), function (t) {
        if (_.includes(templates, pages[t].template)) {
            log("Cleaning: " + t)
            pages[t].template_content = ''
        }
    })

    // TODO: proper order to styles
    var stylesToLoad = _.uniq(_.intersection(styles, home_styles))

    // TODO: proper order to scripts
    var scriptsToLoad = _.uniq(_.flattenDeep(
        _.map(_.keys(pages), function (t) {
            return _.intersection(scripts, pages[t].scripts)
        })))

    function process(nodes, func, final_func) {

        var channelNodes = new Rx.Subject()
        var i = -1

        channelNodes.subscribe(
            function (data) {
                i += data
                if (i < _.size(nodes)) {
                    // var func_name = nodesToLoad[i][0]
                    // var file_path = nodesToLoad[i][1]
                    log("Reloading node (" + func.name + ") #: " + (i + 1))
                    // var func = eval(func_name)
                    func(nodes[i]).subscribe(
                        function onNext(data) {
                        },
                        function onError(err) {
                            console.error(err)
                        },
                        function onComplete(err) {
                            channelNodes.onNext(1)
                        }
                    )
                }
                else {
                    channelNodes.onCompleted()
                }
            },
            function (err) {
            },
            function (end) {
                final_func()
            }
        )

        if (_.size(nodes) > 0) {
            channelNodes.onNext(1)
        } else {
            final_func()
        }

    }

    process(stylesToLoad, reload_css, function () {

        log("Styles completed")

        process(scriptsToLoad, reload_script, function () {

            log("Reload completed")

            resetSammy()
        })

    })
}
