if(typeof Chart !== "undefined") {
    Chart.fromBestdori = (json, sliderDensity, speedMultiplier = 1) => {
        var obj = json;
        if(typeof obj === "string") obj = JSON.parse(obj);

        var map = new Chart();
        map.offset = 0;
        
        var line = null;

        var currentBpm = 0;
        var bpmBeat = 0;
        var bpmTime = 0;

        function beatToTime(b) {
            return bpmTime + (b - bpmBeat) * 32 * (line ? line.bpm / currentBpm : 1);
        }

        function beatToBeat(n, a, b) {
            return n / a * b;
        }

        function laneToX(lane) {
            return K.Maths.lerp(-4.5, 4.5, (lane - 1) / 6);
        }

        var pendSliders = [];
        var sliderA = null;
        var sliderB = null;

        obj.forEach(event => {
            if(event.type == "System" && event.cmd == "BPM") {
                var prevLine = line;
                var baseLine = map.judgeLineList[0];
                if(line != null) {
                    map.judgeLineList.push(line);
                }

                var time = beatToTime(event.beat);
                line = new JudgeLine();
                line.bpm = event.bpm;

                var moveState = new StateEvent();
                moveState.start = 0.5;
                moveState.end = 0.5;
                moveState.start2 = 0.15;
                moveState.end2 = 0.15;
                moveState.startTime = 0;
                moveState.endTime = 999999999;
                line.judgeLineMoveEvents.push(moveState);
        
                var rotateState = new StateEvent();
                rotateState.endTime = 999999999;
                line.judgeLineRotateEvents.push(rotateState);
                
                var speed = new SpeedEvent();
                speed.startTime = 0;
                speed.endTime = 999999999;
                currentBpm = event.bpm;
                speed.value = speedMultiplier * (baseLine ? currentBpm / baseLine.bpm : 1);
                bpmBeat = event.beat;
                bpmTime = prevLine ? time * currentBpm / prevLine.bpm : 0;
                line.speedEvents.push(speed);
            }

            if(event.type == "Note" && event.note == "Single" && !event.flick) {
                var tap = new TapNote();
                tap.time = beatToTime(event.beat);
                tap.positionX = laneToX(event.lane);
                tap.parent = line;
                line.notesAbove.push(tap);
            }
            if(event.type == "Note" && event.flick) {
                var flick = new FlickNote();
                flick.time = beatToTime(event.beat);
                flick.positionX = laneToX(event.lane);
                flick.parent = line;
                line.notesAbove.push(flick);
            }

            if(event.type == "Note" && event.note == "Slide") {
                if(event.start) {
                    if(event.pos == "A") {
                        sliderA = { type: "slider", x: laneToX(event.lane),
                        time: beatToTime(event.beat), nodes: [], line };
                    } else {
                        sliderB = { type: "slider", x: laneToX(event.lane),
                        time: beatToTime(event.beat), nodes: [], line };
                    }
                } else {
                    var slider = event.pos == "A" ? sliderA : sliderB;
                    slider.nodes.push({
                        x: laneToX(event.lane),
                        time: beatToTime(event.beat),
                        line
                    });

                    if(event.end) {
                        pendSliders.push(slider);

                        if(event.flick) {
                            var flick = new FlickNote();
                            flick.time = beatToTime(event.beat);
                            flick.positionX = laneToX(event.lane);
                            flick.parent = line;
                            line.notesAbove.push(flick);
                            slider.hasFlickEnd = true;
                        }

                        if(event.pos == "A") {
                            sliderA = null;
                        } else {
                            sliderB = null;
                        }
                    }
                }
            }
        });

        pendSliders.forEach(s => {
            if(s.nodes.length == 1 && Math.abs(s.nodes[0].x - s.x) < 0.01) {
                var hold = new HoldNote();
                hold.holdTime = s.nodes[0].time - s.time;
                hold.parent = line;
                hold.positionX = s.x;
                hold.time = s.time;
                s.line.notesAbove.push(hold);

                if(!s.hasFlickEnd) {
                    var c = new CatchNote();
                    c.time = s.nodes[0].time;
                    c.positionX = s.x;
                    c.parent = line;
                    s.line.notesAbove.push(c);
                }
            } else {
                for(var i=0; i<s.nodes.length; i++) {
                    var a = i > 0 ? s.nodes[i-1] : s;
                    var b = s.nodes[i];

                    if(i == 0) {
                        var tap = new TapNote();
                        tap.time = a.time;
                        tap.parent = a.line;
                        tap.positionX = a.x;
                        a.line.notesAbove.push(tap);
                    }

                    var density = sliderDensity;
                    var bTime = beatToBeat(b.time, b.line.bpm, a.line.bpm);
                    for(var j=a.time + (i == 0 ? density : 0); j<bTime; j += density) {
                        var c = new CatchNote();
                        c.time = j;

                        var progress = (j - a.time) / (bTime - a.time);
                        c.positionX = K.Maths.lerp(a.x, b.x, 1 - Math.pow(1 - progress, 2));
                        c.parent = a.line;
                        a.line.notesAbove.push(c);
                    }
                }
            }
        });
        line.notesAbove = line.notesAbove.sort((a, b) => a.time - b.time);

        map.judgeLineList.push(line);

        return map;
    }
}