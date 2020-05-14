/*
    this models a polygon where the points are
    defined as radial coordinates
*/
class amyRadialPolygonPath extends noiceCoreChildClass {

/*
    constructor({
        edges:          <int>  (>= 3)
        phase:          <int>  (0 - 1)
        phaseReverse:   <bool> (default false)
    })
*/
constructor (args, defaults, callback){
    super(args, {
        _version:           1,
        _className:         'amyRadialPolygonPath',
        _vertices:          [],
        _phase:             0,
        _noisePhase:        0,
        _phaseReverse:      false,
        _radius:            0,
        _edges:             3,
        _onScreen:          false,
        _DOMElement:        null,
        _stroke:            'red',
        _strokeWidth:       1,
        _strokeOpacity:     .85,
        _fill:              'red',
        _fillOpacity:       .1,
        _perlinRadius:      false,
        _perlinMaxRadius:   0
    }, callback);

    // if vertices are not given, generate them
    if (this.vertices.length == 0){ this.generateVertices(); }


} // end constructor



/*
    vertices
*/
get vertices(){ return(this._vertices); }
set vertices(v){ this._vertices = v; }

get d(){
    let path = [];
    this.vertices.forEach(function(v, i){
        if (i == 0){
            path.push(`M ${v[0]}, ${v[1]}`);
        }else{
            path.push(`L ${v[0]}, ${v[1]}`);
        }
    });
    path.push('z');
    return(path.join(" "));
}
generateVertices(){
    let max      = (Math.PI * 2);
    let inc      = (max/this.edges);
    let v        = [];
    for (let i=0; i < this.edges; i++){
        let t = 0;

        if (this.perlinRadius){
            //let t = Math.sin(((Math.PI*2)/this.edges)*i)*100
            let mp =  Math.sin(((Math.PI*2)/this.edges)*i)*1.5;
            let px = Math.sin((i*inc)+this.phase) * mp;
            let py = Math.cos((-i*inc)-this.phase) * mp;
            t = noise.perlin3(px,py,this._noisePhase) * this.perlinMaxRadius;
        }
        v.push([
            (Math.sin((i*inc)+this.phase) * (this.radius + t)),
            (Math.cos((-i*inc)-this.phase) * (this.radius + t))
        ]);
    }

    this.vertices = v;
}


/*
    perlinRadius
*/
get perlinRadius(){ return(this._perlinRadius); }
set perlinRadius(v){
    this._perlinRadius = (v === true);
    this.generateVertices();
    this._DOMElement.setAttribute('d', this.d);
}
get perlinMaxRadius(){ return(this._perlinMaxRadius); }
set perlinMaxRadius(v){
    this._perlinMaxRadius = v;
    this.generateVertices();
    this._DOMElement.setAttribute('d', this.d);
}


/*
    built in style attributes
*/
get hasDOMElement(){ return(this.DOMElement instanceof Element); }
get stroke(){
    if (this.hasDOMElement){
        return(this.DOMElement.style.stroke);
    }else{
        return(this._stroke);
    }
}
set stroke(v){
    this._stroke = v;
    if (this.hasDOMElement){
        this.DOMElement.style.stroke = v;
    }
}
get strokeWidth(){
    if (this.hasDOMElement){
        return(this.DOMElement.style.strokeWidth);
    }else{
        return(this._strokeWidth);
    }
}
set strokeWidth(v){
    this._strokeWidth = v;
    if (this.hasDOMElement){
        this.DOMElement.style.strokeWidth = v;
    }
}
get strokeOpacity(){
    if (this.hasDOMElement){
        return(this.DOMElement.getAttribute('stroke-opacity'));
    }else{
        return(this._strokeOpacity);
    }
}
set strokeOpacity(v){
    if (this.hasDOMElement){
        this.DOMElement.setAttribute('stroke-opacity',v);
    }
    this._strokeOpacity = v;
}
set fill(v){
    this._fill = v;
    if (this.hasDOMElement){
        this.DOMElement.style.fill = v;
    }
}
get fill(){
    if (this.hasDOMElement){
        return(this.DOMElement.style.fill);
    }else{
        return(this._fill);
    }
}
set fillOpacity(v){
    this._fillOpacity = v;
    if (this.hasDOMElement){
        this.DOMElement.style.fillOpacity = v;
    }
}
get fillOpacity(){
    if (this.hasDOMElement){
        return(this.DOMElement.style.fillOpacity);
    }else{
        return(this._fillOpacity);
    }
}


/*
    get a DOMElement to insert or whatever you want

    // old and busted
*/
get DOMElement(){
    if (!(this._DOMElement instanceof Element)){
        this._DOMElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._DOMElement.classList.add(this._className);
        this._DOMElement.setAttribute('d', this.d);
        ['stroke', 'strokeWidth', 'strokeOpacity','fill','fillOpacity'].forEach(function(attribute){
            this[attribute] = this[`_${attribute}`];
        }, this);
    }
    return(this._DOMElement);
}

get edges(){ return(this._edges); }
set edges(v){
    this._edges = v;
    this.generateVertices();
    this.DOMElement.setAttribute('d', this.d);
}
get phase(){ return(this._phase); }
set phase(v){
    this._phase = v;
    this.generateVertices();
    this.DOMElement.setAttribute('d', this.d);
}
get radius(){ return(this._radius); }
set radius(v){
    this._radius = v;
    this.generateVertices();
    this.DOMElement.setAttribute('d', this.d);
}
get noisePhase(){ return(this._noisePhase); }
set noisePhase(v){
    this._noisePhase = v;
    if (this.perlinRadius){
        this.generateVertices();
        this.DOMElement.setAttribute('d', this.d);
    }
}


/*
    append(DOMElement)
*/
append(DOMElement){
    DOMElement.append(this.DOMElement);
    this._onScreen = true;
    return(this);
}

/*
    remove()
*/
remove(){
    this._DOMElement.parentElement.removeChild(this._DOMElement);
}


}
