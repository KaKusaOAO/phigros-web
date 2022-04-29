class ArcaeaEvent {
    constructor(time) {
        this.time = time;
    }
}

class ArcaeaTimingEvent extends ArcaeaEvent {
    /**
     * 
     * @param {number} time 
     * @param {number} bpm 
     * @param {number} beatsPerLine 
     */
    constructor(time, bpm, beatsPerLine) {
        super(time);
        this.bpm = bpm;
        this.beatsPerLine = beatsPerLine;
    }
}

class ArcaeaTapEvent extends ArcaeaEvent {
    constructor(time, lane) {
        super(time);
        this.lane = lane;
    }
}

class ArcaeaHoldEvent extends ArcaeaEvent {
    constructor(time, endTime, lane) {
        super(time);
        this.endTime = endTime;
        this.lane = lane;
    }
}

class ArcaeaTimingGroup {
    constructor(isPrimary) {
        this.isPrimary = isPrimary;

        /** @type {ArcaeaEvent[]} */
        this.events = [];
    }

    getBaseBPM() {
        return this.events.find(n => {
            return n instanceof ArcaeaTimingEvent;
        }).bpm;
    }
}

class ArcaeaArctapEvent extends ArcaeaEvent {
    /**
     * 
     * @param {number} time 
     * @param {ArcaeaArcEvent} arc 
     */
    constructor(time, arc) {
        super(time);
        this.parent = arc;
    }
}

class ArcaeaArcEvent extends ArcaeaEvent {
    constructor(time, endTime, xStart, xEnd, lineType, yStart, yEnd, color, isVoid) {
        super(time);
        this.endTime = endTime;
        this.start = {
            x: xStart, y: yStart
        };
        this.end = {
            x: xEnd, y: yEnd
        };
        this.lineType = lineType;
        this.color = color;
        this.isVoid = isVoid;

        /** @type {ArcaeaArctapEvent[]} */
        this.arcTaps = [];
    }

    static readLine(line) {
        if(!line.startsWith("arc(")) throw new Error("The given line is not an arc event.");
        var regex = /arc\((\d+?),(\d+?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?),(.*?)\)(?:\[(.*?)\])?;/;
        var event = line.match(regex);

        var arc = new ArcaeaArcEvent(
            parseFloat(event[1]),   // time
            parseFloat(event[2]),   // endTime
            parseFloat(event[3]),   // xStart
            parseFloat(event[4]),   // xEnd
            event[5],   // lineType
            parseFloat(event[6]),   // yStart
            parseFloat(event[7]),   // yEnd
            parseInt(event[8]),     // color
            event[10] == "true"     // isVoid
        );

        var arctaps = event[11];
        if(arctaps) {
            var t = arctaps.split(",");
            t.forEach(n => {
                arc.arcTaps.push(new ArcaeaArctapEvent(
                    parseFloat(n.substring("arctap(".length, n.length - 1)), arc
                ));
            });
        }

        return arc;
    }
}

class ArcaeaChart {
    constructor() {
        this.offset = 0;
        
        /** @type {ArcaeaTimingGroup[]} */
        this.timingGroups = [];
    }

    getPrimaryGroup() {
        return this.timingGroups.find(n => {
            return n.isPrimary;
        });
    }

    /**
     * 
     * @param {string} raw 
     */
    static deserialize(raw) {
        var chart = new ArcaeaChart();
        var primaryGroup = new ArcaeaTimingGroup(true);
        chart.timingGroups.push(primaryGroup);
        var targetGroup = primaryGroup;

        raw.split("\n").forEach((line, i) => {
            if(i == 0) {
                // First line:
                // AudioOffset:N (ms)
                if(!line.startsWith("AudioOffset:")) throw new Error(`The first line is not "AudioOffset:...".`);
                chart.offset = parseFloat(line.substring("AudioOffset:".length));
                return;
            }

            if(i == 1) {
                if(line.trim() != "-") throw new Error(`The second line is not a single dash (-).`);
                return;
            }

            line = line.trim();

            if(i >= 2) {
                if(line.startsWith("timinggroup(")) {
                    var group = new ArcaeaTimingGroup(false);
                    chart.timingGroups.push(group);
                    targetGroup = group;
                } else if(line.startsWith("};")) {
                    targetGroup = primaryGroup;
                } else if(line.startsWith("timing(")) {
                    var event = line.substring("timing(".length, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaTimingEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    ));
                } else if(line.startsWith("(")) {
                    // Single Note
                    var event = line.substring(1, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaTapEvent(
                        parseFloat(event[0]), parseFloat(event[1]),
                    ));
                } else if(line.startsWith("arc(")) {
                    targetGroup.events.push(ArcaeaArcEvent.readLine(line));
                } else if(line.startsWith("hold(")) {
                    // Single Hold note
                    var event = line.substring("hold(".length, line.length - 2).split(",");
                    targetGroup.events.push(new ArcaeaHoldEvent(
                        parseFloat(event[0]), parseFloat(event[1]), parseFloat(event[2])
                    ));
                }
            }
        });
        return chart;
    }
}

var ArcaeaEasing = {
    S: (a, b, t) => {
        return (1 - t) * a + b * t;
    },
    O: (a, b, t) => {
        return a + (b - a) * (1 - Math.cos(1.5707963 * t));
    },
    I: (a, b, t) => {
        return a + (b - a) * (Math.sin(1.5707963 * t));
    },
    B: (a, b, t) => {
        var o = 1 - t;
        // a^3 + 3a^2b + 3ab^2 + b^3
        return Math.pow(o, 3) * a + 3 * Math.pow(o, 2) * t * a + 3 * o * Math.pow(t, 2) * b + Math.pow(t, 3) * b;
    },

    resolveX: (a, b, t, type) => {
        switch(type) {
            case "s":
                return ArcaeaEasing.S(a, b, t);
            case "b":
                return ArcaeaEasing.B(a, b, t);
        }

        if(type.startsWith("si")) {
            return ArcaeaEasing.I(a, b, t);
        }
        if(type.startsWith("so")) {
            return ArcaeaEasing.O(a, b, t);
        }
        return a + (b - a) * t;
    },
     
    resolveY: (a, b, t, type) => {
        switch(type) {
            case "s":
            case "si":
            case "so":
                return ArcaeaEasing.S(a, b, t);
            case "b":
                return ArcaeaEasing.B(a, b, t);
        }

        if(type.endsWith("si")) {
            return ArcaeaEasing.I(a, b, t);
        }
        if(type.endsWith("so")) {
            return ArcaeaEasing.O(a, b, t);
        }
        return a + (b - a) * t;
    }
}

if(typeof Chart !== "undefined") {
    function laneToX(lane) {
        return K.Maths.lerp(-4, 4, (lane - 1) / 3);
    }

    function arcXToPhigros(x) {
        return K.Maths.lerp(-4, 4, (x + 0.25) / 2 / 3 * 4);
    }

    function arcXToPhigrosLine(x) {
        return K.Maths.lerp(0.275, 0.725, (x + 0.25) / 2 / 3 * 4);
    }

    function arcTimeToPhigros(time, bpm) {
        return time / 1875 * bpm;
    }

    /**
     * 
     * @param {ArcaeaChart} arcaea 
     * @param {*} arcDensity 
     */
    Chart.fromArcaea = (arcaea, arcDensity, speedMultiplier = 1) => {
        var chart = new Chart();
        chart.offset = arcaea.offset * -0.001;
        var baseBPM = arcaea.getPrimaryGroup().getBaseBPM();

        arcaea.timingGroups.forEach(g => {
            var arcLine = new JudgeLine();
            var notesLine = new JudgeLine();
    
            arcLine.bpm = baseBPM;
            notesLine.bpm = baseBPM;
    
            var s1 = new StateEvent();
            s1.startTime = 0;
            s1.endTime = 99999999;
            s1.start = 0.5;
            s1.end = 0.5;
            s1.start2 = 0.15;
            s1.end2 = 0.15;
    
            var s2 = new StateEvent();
            s2.startTime = 0;
            s2.endTime = 99999999;
            s2.start = 0.5;
            s2.end = 0.5;
            s2.start2 = 0.15;
            s2.end2 = 0.15;
            
            arcLine.judgeLineMoveEvents.push(s1);
            notesLine.judgeLineMoveEvents.push(s2);

            chart.judgeLineList.push(arcLine, notesLine);
        
            var speeds = [
                { time: -1, endTime: 99999999, speed: 1 }
            ];

            var currentSpeed = 1;

            g.events.forEach(event => {
                if(event instanceof ArcaeaTapEvent) {
                    var tap = new TapNote();
                    tap.time = arcTimeToPhigros(event.time, baseBPM);
                    tap.positionX = laneToX(event.lane);
                    tap.parent = notesLine;
                    notesLine.notesAbove.push(tap);
                } else if(event instanceof ArcaeaHoldEvent) {
                    var hold = new HoldNote();
                    hold.time = arcTimeToPhigros(event.time, baseBPM);
                    hold.holdTime = arcTimeToPhigros(event.endTime - event.time, baseBPM);
                    hold.positionX = laneToX(event.lane);
                    hold.parent = notesLine;
                    notesLine.notesAbove.push(hold);
                } else if(event instanceof ArcaeaTimingEvent) {
                    var speed = event.bpm / baseBPM;
                    currentSpeed = speed;

                    speeds[speeds.length - 1].endTime = arcTimeToPhigros(event.time, baseBPM);
                    speeds.push(
                        { time: arcTimeToPhigros(event.time, baseBPM), endTime: 99999999, speed }
                    );
                } else if(event instanceof ArcaeaArcEvent) {
                    // This would be the most complicated process.
                    var aTime = arcTimeToPhigros(event.time, baseBPM);
                    var bTime = arcTimeToPhigros(event.endTime, baseBPM);

                    if(!event.isVoid) {
                        var density = arcDensity;
                        for(var i = aTime; i < bTime; i += density) {
                            var c = new CatchNote();
                            c.time = i;

                            var progress = (i - aTime) / (bTime - aTime);
                            c.positionX = arcXToPhigros(ArcaeaEasing.resolveX(event.start.x, event.end.x, progress, event.lineType));
                            c.parent = arcLine;
                            arcLine.notesAbove.push(c);
                        }
                    } else {
                        var voidLine = new JudgeLine();
                        voidLine.bpm = baseBPM;

                        var a1 = new StateEvent();
                        a1.startTime = -99999999;
                        a1.endTime = aTime;
                        a1.start = a1.end = 0;

                        var a2 = new StateEvent();
                        a2.startTime = aTime;
                        a2.endTime = bTime;
                        a2.start = a2.end = 0.25;

                        var a3 = new StateEvent();
                        a3.startTime = bTime;
                        a3.endTime = 99999999;
                        a3.start = a3.end = 0;

                        voidLine.judgeLineDisappearEvents.push(a1, a2, a3);

                        for(var i = aTime; i < bTime; i++) {
                            var s = new StateEvent();
                            s.startTime = i;
                            s.endTime = i+1;
                            
                            var pA = (i - aTime) / (bTime - aTime);
                            s.start = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pA, event.lineType));
                            var pB = (i+1 - aTime) / (bTime - aTime);
                            s.end = arcXToPhigrosLine(ArcaeaEasing.resolveX(event.start.x, event.end.x, pB, event.lineType));
                            s.start2 = s.end2 = 0.15;
                            voidLine.judgeLineMoveEvents.push(s);

                            var r = new StateEvent();
                            r.startTime = i;
                            r.endTime = i+1;
                            r.start = r.end = 90 - (s.end - s.start) * 180;
                            voidLine.judgeLineRotateEvents.push(r);
                        }

                        chart.judgeLineList.push(voidLine);

                        event.arcTaps.forEach(t => {
                            var progress = (arcTimeToPhigros(t.time, baseBPM) - aTime) / (bTime - aTime);

                            var flick = new FlickNote();
                            flick.time = arcTimeToPhigros(t.time, baseBPM);
                            flick.positionX = arcXToPhigros(ArcaeaEasing.resolveX(event.start.x, event.end.x, progress, event.lineType));
                            flick.parent = arcLine;
                            arcLine.notesAbove.push(flick);
                        })
                    }
                }
            });

            speeds.forEach((s, i) => {
                if(i == 0) return;

                var sa = new SpeedEvent();
                sa.startTime = s.time;
                sa.endTime = s.endTime;
                sa.value = s.speed * 1.25 * speedMultiplier;
                
                var sn = new SpeedEvent();
                sn.startTime = s.time;
                sn.endTime = s.endTime;
                sn.value = s.speed * 1.25 * speedMultiplier;

                arcLine.speedEvents.push(sa);
                notesLine.speedEvents.push(sn);
            });
        });

        chart.solveSiblings();
        return chart;
    }
}
