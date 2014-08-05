 function Sender() {
    // See https://cast.google.com/publish/#/overview
    this.applicationID_ = "917A9D6E";
    this.session_ = null;
    this.PROGRESS_INTERVAL = 1000;

    // Wait for Chromecast to be detected
    window['__onGCastApiAvailable'] = function(loaded, errorInfo) {
      if (loaded) {
        this.initializeCastApi_();
      } else {
        console.log(errorInfo);
      }
    }.bind(this);
};

Sender.prototype.initializeCastApi_ = function() {
    console.debug("Sender.js: initializeCastApi_()");     
    // Create API config with session listeners
    var sessionRequest = new chrome.cast.SessionRequest(this.applicationID_);
    var apiConfig = new chrome.cast.ApiConfig(sessionRequest,
        function(e) {
            console.log('connected to session: ' + e.sessionId);
            this.session_ = e;

            // Initialise UI only after session exists
            this.initializeUI_();
            this.session_.
                addMediaListener(this.onMediaUpdateListener_.bind(this))
        }.bind(this),
        function(e) {
            if (e === 'available') { console.log('receiver found'); }
            else { console.log('receiver list empty'); }
        }
    );

    // Initialise Chromecast
    chrome.cast.initialize(apiConfig,
    function() {
        // Devices are available and can be connected to, lets grab a session
        console.log("initialization success");
        setTimeout(function() {
            if(this.session_ == null) {
                console.log("no existing session found - requesting new one");
                chrome.cast.requestSession(function(e) {
                    console.log('session request success');
                    this.session_ = e;

                    // Initialise UI only after session exists
                    this.session_.
                        addMediaListener(this.onMediaUpdateListener_.
                            bind(this));
                    this.initializeUI_();
                }.bind(this),
                function(e) {
                    console.log('session request failure');
                    console.log(e);
                });
            }
        }.bind(this), 2000);
    }.bind(this),
    function(e){
        console.log("initialization failure");
        console.log(e);
    });
}

Sender.prototype.onMediaUpdateListener_ = function(media) {
    console.debug("Sender.js: onMediaUpdateListener_()");
    this.updateUI_(media);
    media.addUpdateListener(function() {
        this.updateUI_(media);
    }.bind(this));
}

Sender.prototype.secondsToTime_ = function(seconds) {
    console.debug("Sender.js: secondsToTime_()");
    var minutes = parseInt(Math.floor(seconds / 60));
    var seconds = parseInt(seconds % 60);
    if(isNaN(minutes)) minutes = 0;
    if(isNaN(seconds)) seconds = 0;

    if(seconds < 10) seconds = "0" + seconds;
    return minutes + ":" + seconds;
} 

Sender.prototype.initializeUI_ = function() {
    console.debug("Sender.js: initializeUI_()");
    $("input, button").on("mouseup", function(e) {
        var commandName = $(e.target).data("command");
        var functionName = "command" + commandName.charAt(0).toUpperCase() +
            commandName.slice(1) + "_";
        this[functionName](e.target);
    }.bind(this))

    setInterval(this.commandStatusRequest_.bind(this), this.PROGRESS_INTERVAL);

    if(this.session_.media.length > 0) {
        if(this.session_.media[0].playerState ===
                chrome.cast.media.PlayerState.PAUSED) {
            $("button[data-command='pause']").html("Play");
            $("button[data-command='pause']").data("command", "play");
        }
        this.updateUI_(this.session_.media[0]);
        this.session_.media[0].addUpdateListener(function() {
            this.updateUI_(this.session_.media[0]);
        }.bind(this));
    }
}

Sender.prototype.updateUI_ = function(media) {
    console.debug("Sender.js: updateUI_(" + media + ")");
    console.log(media);
    if(media.playerState === chrome.cast.media.PlayerState.IDLE) {
        return;
    }

    
    var currentTimeRaw = media.currentTime;
    var totalTimeRaw = media.media.duration;
    var currentTime = this.secondsToTime_(currentTimeRaw);
    var totalTime = this.secondsToTime_(totalTimeRaw);
    var percentComplete = (100 / totalTimeRaw) * currentTimeRaw;
    
    // Current timing
    $(".current-time").html(currentTime);
    $(".total-time").html(totalTime);
    $("#progress-bar").val(percentComplete);

    // Update author and title
    $(".meta").css("visibility", "visible");
    $(".author").html(media.media.metadata.author + ": ");
    $(".title").html(media.media.metadata.title);
}

Sender.prototype.commandStatusRequest_ = function() {
    console.debug("Sender.js: commandStatusRequest_()");
    if(!this.session_.media[0]) return;

    this.session_.media[0].getStatus(new chrome.cast.media.GetStatusRequest(),
        function(e) {
            console.log("Status request completed successfully");
        },
        function(e) {
            console.log("Status request failed");
        }
    );
} 

Sender.prototype.commandLoad_ = function(e) {
    console.debug("Sender.js: commandLoad_()");

    // Set loading text
    $(".meta").css("visibility", "visible");

    // Load actual videp
    var videoID = $("#videoID").val(); 
    var mediaInfo = new chrome.cast.media.MediaInfo(videoID, "yt");
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    request.currentTime = 0;
    this.session_.loadMedia(request, this.onMediaUpdateListener_.bind(this), 
        function() {
        console.error("commandLoad_(): failure")
    });
}

Sender.prototype.commandPause_ = function(e) {
    console.debug("Sender.js: commandPause_()");
    if(!this.session_.media[0]) return;

    // Switch command for next press
    $(e).data("command", "play");
    $(e).html("Play");
    $(e).prop("disabled", true);

    this.session_.media[0].pause(new chrome.cast.media.PauseRequest(),
        function() {
            console.log("Pause request completed successfully");
            $(e).prop("disabled", false);
        },
        function(e) {
            console.log("Pause request failed");
            $(e).prop("disabled", false);
        }
    );
}

Sender.prototype.commandPlay_ = function(e) {
    console.debug("Sender.js: commandPlay_()");
    if(!this.session_.media[0]) return;

     // Switch command for next press
    $(e).data("command", "pause");
    $(e).html("Pause");
    $(e).prop("disabled", true);

    this.session_.media[0].play(new chrome.cast.media.PlayRequest(),
        function() {
            console.log("Play request completed successfully");
            $(e).prop("disabled", false);
        },
        function(e) {
            console.log("Play request failed");
            $(e).prop("disabled", false);
        }
    )
}

Sender.prototype.commandSeek_ = function(e) {
    console.debug("Sender.js: commandSeek_()");
    if(!this.session_.media[0]) return;

    // Switch command for next press
    
}