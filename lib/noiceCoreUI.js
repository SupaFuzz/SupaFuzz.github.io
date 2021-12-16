/*
    noiceCoreUI.js
    this extends noiceCoreUtility to interact with the DOM

    NOTE: 2/28/2020 this mostly works but it needs to be rewritten
    and it absolutely does not work without setting a getHRMLCallback for literally everything

    LOOSE END: 11/14/18
    web components are *probably* the way to go with this. unfortunately I'm in a time crunch
    here and I don't have time to get on top of this, but yeah. This might be where it's at:

    https://www.webcomponents.org
    https://developer.mozilla.org/en-US/docs/Web/Web_Components
*/


/*
    noiceCoreUIElement
    this models a DOM Element, or more accurately an arbitrary subtree of DOM
    Element objects that we wish to interact with on an application level.

    how this works.

    we have an internal attribute this._documentFragment.

    when we instantiate an object we render this.html into this._documentFragment
    by way of a div element manually inserted into _documentFragment which will
    have this form:

        <div id="${this.guid}" class="${this.classList.join(' ')}">${this.html}</div>

    this renders a DOM tree for this.html into this._documentFragment.
    this.DOMElement is a reference to the outer div with id = this.guid.

    since this.html has been rendered into DOM objects, these are now accessible
    via standard DOM methods, in paricular the Element interface using this.DOMElement
    as the parent object.

    If this.renderCallback() is defined (and it's a function), we will call this
    function upon instantiation after this.html is rendered into this._documentFragment
    giving you the option of doing setup and hanging hooks on your content or
    whatever needs to be done.

    to make this visible on screen, we need to insert the _documentFragment
    somewhere beneath document.body. We can do this with the append(<DOM Element>)
    function. So for instance something like: this.append(document.body)

    Since a DOM Element can only be a child of one document at a time, this removes
    the object from this._documentFragment. Likewise to remove the element from
    the visible DOM, and put it back into this._documentFragment, simply call
    this.remove()

    Attributes:
        * name              <string>    (optional)
        * guid              <string>    default: set on instantiation
        * DOMElement        <Element>   set on instantiation, as described above
        * html              <string>    html content string
        * classList         <Array>     array of strings representing CSS classes
        * renderCallback    <Function>  if specified, call this function on instantiation after inserting *.html into *_documentFragment
        * getHTMLCallback   <Function>  if specified, we will call this external function and return whatever it returns on *.html
        * onScreen          <bool>      true if the object is in the visible dom, false if it's in the _documentFragment
    Functions:
        * render(<DOM Element)
          this inserts *.html into *._documentFragment. it is typically called on instantiation
          if <DOM Element> is specified, we will automatically call append (see below) after rendering
          into the _documentFragment

        * append(<DOM Element>)
          remove the contents of *_documentFragment and insert them as a child (DOM.appendChild()) of the specified DOM Element

        * remove()
          append this.DOMElement as a child of this._documentFragment (saving it in self and removing it from the visible DOM)

*/
class noiceCoreUIElement extends noiceCoreUtility {


// constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:           1,
        _className:         'noiceCoreUIElement',
        _documentFragment:  document.createDocumentFragment(),
        classList:          [],
        onScreen:           false,
        // stubs to prevent overriding getter/setters
        _html:              ''
    }, defaults);

    /*
        this is a bit of a hack, but I like it
        noiceCoreUIElement descendants need to call this.render()
        before the child class constructor distributes values to
        it's attribute setters. They need to do this, because they
        all like to use setters for DOM properties, and it is pretty
        slick.

        since noiceCoreUIElement is a descendant of noiceCoreUtility
        which is a descendant of noiceCoreChildClass, we can wrap the
        callback arguent with our own hard-coded call to this.render()
        before invoking any passthrough callback. This calls render
        before the child class setters.
    */
    super(args, _classDefaults, function(self){
        if (callback instanceof Function){ callback(self); }
        if (! self.hasAttribute('name')){ self.name = self._className; }
        if (self.classList.indexOf(self._className) < 0){ self.classList.push(self._className); }
        self.guid = self.getGUID();
        self.render();
    });

} // end constructor


/*
    html getter
*/
set html(val){
    this._html = val;
    if (this.hasOwnProperty('DOMElement')){ this.update(); }
}

get html(){
    let that = this;

    if (this.hasAttribute('getHTMLCallback') && (this.getHTMLCallback instanceof Function)){
        try {
            return(that.getHTMLCallback(that));
        }catch(e){
            throw(new noiceException({
                message:        `getHTMLCallback threw an error: ${e.toString()}`,
                messageNumber:   100,
                thrownBy:       `${that._className}/html`
            }));
        }
    }else if (this.isNotNull(this._html)){
        return(this._html);
    }else{
        // default html template. you'll probably override this in an extension class or use getHTMLCallback()
        return(`<span class="className">${this._className}</span> <span class="version">version ${this._version}</span>`);
    }
}


/*
    render()
    create a div in the documentFragment with id=this.guid
    the classlist and containing this.html
    separate function from constructor because subclasses will likely need to override this
    render should be chainable, so we always return this (even if you override it stil do this)
*/
render(){
    this.DOMElement = document.createElement('div');
    this.DOMElement.id = this.guid;
    this._documentFragment.appendChild(this.DOMElement);
    this.classList.forEach(function(c){ this.DOMElement.classList.add(c); }, this)
    this.DOMElement.innerHTML = this.html;
    let that = this;
    if (this.hasAttribute('renderCallback') && (this.renderCallback instanceof Function)){ that.renderCallback(that); }
    this.onScreen = false;
    return(this);
}


/*
    update()
    replace the innerHTML of this.DOMElement with this.html
    necessarily calling getHTMLCallback (if defined).
    This is a component of "data binding" where in we can set
    data attributes on the object then reference them in getHTMLCallback
*/
update(){
    // update the html
    this.DOMElement.innerHTML = this.html;

    // re-run the render callback to hang all ye hooks while ye may ...
    let that = this;
    if (this.hasAttribute('renderCallback') && (this.renderCallback instanceof Function)){ that.renderCallback(that); }

    return(this);
}


/*
    append(<DOM Element>)
    you might also wanna override this if you've got a subclass that's keeping lots of things in the
    _documentFragment and you just want to append one of them rather than the whole thing.
    but by default we're gonna insert everything in the _documentFragment
*/
append(DOMElement){

    if (this.isNotNull(DOMElement) && (DOMElement instanceof Element)){
        /* WTF
        this.parentDOMElementID = DOMElement.id;
        console.log(this.parentDOMElementID)
        */
        DOMElement.appendChild(this._documentFragment);
        this.onScreen = true;
    }else{
        throw(new noiceException({
            message:        `specified DOM Element is not an instance of Element`,
            messageNumber:   101,
            thrownBy:       `${this._className}/render`
        }));
    }
    return(this);
}


/*
    remove()
    pull everything out of wherever it is (presumably the visible DOM, but really who knows?)
    and insert it back into _documentFragment
*/
remove(){
    this._documentFragment.appendChild(this.DOMElement);
    this.onScreen = false;
}


/*
    getEventListener(<functionReference>)
    return a function in which we call thusly:
        functionReference(event, self)

    this allows us to pass a self reference to event handlers
    and it allows you to save a variable reference to the function
    so you can remove it from the eventHanler later
*/
getEventListenerWrapper(functionReference){
    let that = this;
    return(
        function(e){ functionReference(e, that); }
    )
}


} // end noiceCoreUIElement class




/*
    noiceCoreUIOverlay
    this class extends the coreUIElement to be an absolutely positioned
    element with a defined z-index, potentially full screen (but not necessarily)
    this class is extended to make things like modalDialogs, splashScreens and
    floating menus

    at the end of the day this is really just a regular coreUIElement
    with some hard coded css attributes.

    so, this is the default coreUIElement content:
        <div id="${this.guid}" class="${this.classList.join(' ')}">${this.html}</div>

    what we're gonna do is we are going to take that outer div and we are going to
    apply this css:

        #${this.guid} {
            position:           absolute;
            overflow:           hidden;
            display:            flex;
            justify-content:    ${this.hasAttribute('justifyContent')?this.justifyContent:center};
            align-items:        ${this.hasAttribute('alignItems')?this.alignItems:center};
            width:              ${this.hasAttribute('width')?this.width:'100%'};
            height:             ${this.hasAttribute('height')?this.height:'100%'};
            left:               ${this.hasAttribute('x')?this.x:0};
            top:                ${this.hasAttribute('y')?this.y:0};
            z-index:            ${this.hasAttribute('z')?this.z:0};
        }

    this makes the outer div a css layer at z-index (this.z), which clips it's content.
    by default, it's setup to occupy 100% of it's containing element.

    so, this makes an overlay into which you can dump your content with this.html
    NOTE that we're not defining things like background opacity, etc ... all of that is
    for an external CSS file.

*/
class noiceCoreUIOverlay extends noiceCoreUIElement {


// constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:           1,
        _className:         'noiceCoreUIOverlay',
        _justifyContent:    'center',
        _alignItems:        'center',
        _width:             '100%',
        _height:            '100%',
        _x:                 '0',
        _y:                 '0',
        _z:                 '0',
        // stubs to prevent overriding getter/setters
        _html:              ''
    }, defaults);

    // set it up
    super(args, _classDefaults, callback);

    /*
        NOTE: the parent class constructor called render() and renderCallback() for us
        so now we're just gonna apply the hard-coded css styles to this.DOMElement right here
        but we're going to do it in the applyNecessaryStyle() function so that extension
        classes can override it
    */

    this.applyNecessaryStyle();
} // end constructor


/*
    applyNecessaryStyle()
    apply hard-coded css attributes
*/
applyNecessaryStyle(){
    let myNecessaryStyle = {
        position:       'absolute',
        overflow:       'hidden',
        display:        'flex',
        justifyContent: this.justifyContent,
        alignItems:     this.alignItems,
        width:          this.width,
        height:         this.height,
        left:           this.x,
        top:            this.x,
        zIndex:         this.z
    }
    Object.keys(myNecessaryStyle).forEach(function(k){ this.DOMElement.style[k] = myNecessaryStyle[k]; }, this);
}

/*
    getters and setters for css passthrough properties
*/
get justifyContent(){ return(this._justifyContent); }
set justifyContent(str){
    this.DOMElement.style.justifyContent = str;
    this._justifyContent = str;
}

get alignItems(){ return(this._alignItems); }
set alignItems(str){
    this.DOMElement.style.alignItems = str;
    this._alignItems = str;
}

get width(){ return(this._width); }
set width(str){
    this.DOMElement.style.width = str;
    this._width = str;
}

get height(){ return(this._height); }
set height(str){
    this.DOMElement.style.height = str;
    this._height = str;
}

get x(){ return(this._x); }
set x(str){
    this.DOMElement.style.left = str;
    this._x = str;
}

get y(){ return(this._y); }
set y(str){
    this.DOMElement.style.top = str;
    this._y = str;
}

get z(){ return(this._z); }
set z(str){
    this.DOMElement.style.zIndex = str;
    this._z = str;
}


} // end noiceCoreUIOverlay class




/*
    noiceCoreUIDialog
    this extends noiceCoreUIOverlay to make a dialog
    that is, a full screen overlay with an html payload centered
    vertically and horizontally on the screen, which blocks access
    to all other UI elements.

    we set a super high z-index (999) by default to try and make this float on top of
    everything else. Since this is a subclass of noiceCoreUIOverlay you can change
    that by setting the *.z property if you need to.

    by default *.html is:
        <div class="${this.dialogContentClass}"><span class="${this.dialogMessageClass}">${this.message}</span></div>

    we have these attributes:

        * dialogContentClass   <str> default: 'dialogContentClass'
          apply this class to the visible container div (if using default *.html)

        * dialogMessageClass    <str> default: 'dialogMessageClass'
          apply this class to the element containing *.message (if using default *.html)

        * message               <str> default: this._className
          setting this value updates the textContent of the first child with
          class="${this.dialogMessageClass}"  if you have overridden the default *.html
          or specified *.getHTMLCallback(), and you  do not have a child with
          class="${this.dialogMessageClass}", you can also specify ...

        * messageDOMElement     <Element>
          if this attribute is set, and it is an instance of the DOM Element class, we will
          update textContent of this when *.message is set, rather than looking for the first
          child with class="${this.dialogMessageClass}"

        * showCallback          <Function>
          if specified, we will execute this external callback when the show() function is called
          but before inserting into the visible DOM. Hence the openCallback can abort display
          if it throws.

        * hideCallback         <Function>
          just like showCallback, but we do it when hide() is called.

        * alert                <bool> default: false
          if set true, we append the "alert" class to this.DOMElement, if false we remove it
          this allows you to decorate important messages accordingly in the external CSS

    and these functions:

        * show()
          call this.insert(document.body), but call the showCallback() first if we have one

        * hide()
          call this.remove(), but call the hideCallback() first if we have one

*/
class noiceCoreUIDialog extends noiceCoreUIOverlay {


// constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:               1,
        _className:             'noiceCoreUIDialog',
        _z:                     '999',
        _message:               '',
        _alert:                 false,
        dialogContentClass:    'dialogContentClass',
        dialogMessageClass:    'dialogMessageClass',
        _html:                 ''
    }, defaults);

    // set it up
    super(args, _classDefaults, callback);

    // set default message to classname
    //if (! this.isNull('message')){ this.message = this._className; }

} // end constructor


/*
    html getter
*/
get html(){
        /*
            let the parent class handle dispatching getHTMLCallback if we have one
            if that throws, it'll throw here and spit out the right noiceException
            we could care less what the parent *.html spits back, we'll replace it
            with our own contents (unless we had an htmlCallback then we'll use that)
        */
        let bogus = super.html;
        if (this.hasAttribute('getHTMLCallback') && (this.getHTMLCallback instanceof Function)){
            return(bogus);
        }else{
            return(`<div class="${this.dialogContentClass}"><span class="${this.dialogMessageClass}">${this.message}</span></div>`);
        }

}


/*
    getter and setter for *.alert
*/
get alert(){ return(this._alert); }
set alert(bool){
    this._alert = false;
    if (bool === true){ this._alert = true; }
    if (this.alert){
        this.DOMElement.classList.add('alert');
    }else{
        this.DOMElement.classList.remove('alert');
    }
}


/*
    getter and setter for *.message
*/
get message(){ return(this._message); }
set message(str){
    this._message = str;
    if (this.hasAttribute('messageDOMElement') && (this.messageDOMElement instanceof Element)){
        this.messageDOMElement.textContent = this.message;
    }else{
        this.DOMElement.querySelector(`.${this.dialogMessageClass}`).textContent = this.message;
    }
}


/*
    show()
*/
show(){
    if (this.hasAttribute('showCallback') && (this.showCallback instanceof Function)){
        try {
            this.showCallback()
        }catch(e){
            throw(new noiceException({
                message:        `showCallback() threw an error preventing show(): ${e.toString()}`,
                messageNumber:   102,
                thrownBy:       `${this._className}/show`
            }));
        }
    }
    this.append(document.body);
}


/*
    hide()
*/
hide(){
    let that = this;
    if (this.hasAttribute('hideCallback') && (this.hideCallback instanceof Function)){
        try {
            that.hideCallback(that);
        }catch(e){
            throw(new noiceException({
                message:        `hideCallback() threw an error preventing hide(): ${e.toString()}`,
                messageNumber:   103,
                thrownBy:       `${this._className}/hide`
            }));
        }
    }
    this.remove();
}


} // end noiceCoreUIDialog class




/*
    noiceCoreUIYNDialog
    this extends noiceCoreUIDialog to implement your basic "yes/no" dialog

    by default *.html is:
        <div class="${this.dialogContentClass}">
            <h1 class="${this.dialogHeadingClass}">${this.heading}</h1>
            <p class="${this.dialogMessageClass}">${this.message}</p>
            <button class="${this.yesButtonClass}">${this.yesButtonTxt}</button>
            <button class="${this.noButtonClass}">${this.noButtonTxt}</button>
        </div>

    attributes:
        * dialogContentClass   <str> default: 'dialogContentClass'
          apply this class to the visible container div (if using default *.html)

        * dialogHeadingClass    <str> default: 'dialogHeadingClass'
          apply this class to the h1 heading

        * heading               <str> default: ${this._className}
          this is the textContent of the <h1> (this is the title of the dialog)

        * dialogMessageClass    <str> default: 'dialogMessageClass'
          apply this class to the element containing *.message (if using default *.html)

        * message               <str> default: ${this._className}
          setting this value updates the textContent of the first child with
          class="${this.dialogMessageClass}"  if you have overridden the default *.html
          or specified *.getHTMLCallback(), and you  do not have a child with
          class="${this.dialogMessageClass}", you can also specify ...

        * messageDOMElement     <Element>
          if this attribute is set, and it is an instance of the DOM Element class, we will
          update textContent of this when *.message is set, rather than looking for the first
          child with class="${this.dialogMessageClass}"

        * yesButtonClass        <str> default: 'dialogYesButtonClass'
          apply this class to the yes button

        * yesButtonTxt          <str> default: 'yes'
          set this text as the label on the yes button

        * noButtonClass         <str> default: 'dialogNoButtonClass'
          apply this class to the no button

        * noButtonTxt           <str> default: 'no'
          set this text as the label on the no button

        * zTmpDialogResult      <bool> default: false
          when the dialog closes, we will set this value to true if the user
          clicked the yes button, and false if they clicked the no button
          you can reference this in your hideCallback()

        * showCallback          <Function>
          if specified, we will execute this external callback when the show() function is called
          but before inserting into the visible DOM. Hence the openCallback can abort display
          if it throws.

        * hideCallback         <Function>
          just like showCallback, but we do it when hide() is called.
*/
class noiceCoreUIYNDialog extends noiceCoreUIDialog {


// constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:               1,
        _className:             'noiceCoreUIYNDialog',
        _heading:               '',
        _yesButtonTxt:          'yes',
        _noButtonTxt:           'no',
        zTmpDialogResult:       false,
        yesButtonClass:         'dialogYesButtonClass',
        noButtonClass:          'dialogNoButtonClass',
        dialogHeadingClass:     'dialogHeadingClass',
        _html:                 ''
    }, defaults);

    // set it up
    super(args, _classDefaults, callback);

    // set default message and heading to classname
    ['message', 'heading'].forEach(function(attribute){
        if (this.isNull(this[attribute])){ this[attribute] = this._className; }
    }, this);

    // hang hooks on the buttons
    let self = this;
    this.DOMElement.querySelector(`button.${this.yesButtonClass}`).addEventListener("click", function(evt){
        self.zTmpDialogResult = true;
        self.hide();
    });
    this.DOMElement.querySelector(`button.${this.noButtonClass}`).addEventListener("click", function(evt){
        self.zTmpDialogResult = false;
        self.hide();
    });

    // intercept the openCallback (if there is one) to reset zTmpDialogResult
    if (this.hasAttribute('openCallback') && (this.openCallback instanceof Function)){ this._openCallback = this.openCallback; }
    this.openCallback = this.resetBoolOnOpen;

} // end constructor


/*
    resetBoolOnOpen
    this wraps the openCallback() if one (if specified) and resets the zTmpDialogResult to false whenever the
    dialog opens
*/
resetBoolOnOpen(){
    this.zTmpDialogResult = false;
    if (this.hasAttribute('_openCallback') && (this._openCallback instanceof Function)){ this._openCallback(); }
}


/*
    html getter override
*/
get html(){
    let bogus = super.html;
    if (this.hasAttribute('getHTMLCallback') && (this.getHTMLCallback instanceof Function)){
        return(bogus);
    }else{
        return(
            `<div class="${this.dialogContentClass}">
                <h1 class="${this.dialogHeadingClass}">${this.heading}</h1>
                <p class="${this.dialogMessageClass}">${this.message}</p>
                <button class="${this.yesButtonClass}">${this.yesButtonTxt}</button>
                <button class="${this.noButtonClass}">${this.noButtonTxt}</button>
            </div>`
        );
    }
}


/*
    getter and setter for heading
*/
get heading(){ return(this._heading); }
set heading(str){
    this._heading = str;
    this.DOMElement.querySelector(`.${this.dialogHeadingClass}`).textContent = str;
}


/*
    getter and setter for yestButtonTxt
*/
get yesButtonTxt(){ return(this._yesButtonTxt); }
set yesButtonTxt(str){
    this._yesButtonTxt = str;
    this.DOMElement.querySelector(`.${this.yesButtonClass}`).textContent = str;
}


/*
    getter and setter for noButtonTxt
*/
get noButtonTxt(){ return(this._noButtonTxt); }
set noButtonTxt(str){
    this._noButtonTxt = str;
    this.DOMElement.querySelector(`.${this.noButtonClass}`).textContent = str;
}


} // end noiceCoreUIYNDialog class




/*
    noiceCoreUIHeaderMenu
    this extends noiceCoreUIDialog to create an overlay welded to the top of the viewport
    (or the containing block).

    The overlay has a minumum size, such that the "bottom" is always visible on screen.
    We will call this the "menuHandle". When clicked, the menuHandle expands the overlay
    downward to expose arbitrary html content (probably your menu with some buttons). We
    will call this the "menuContent". When subsequently clicked, the menuHandle collapses
    the overlay to it's minimum height, hiding the menuContent

    default *.html is:
        <div class="${this.dialogContentClass}">
            <div class="${this.dialogContentClass}">${this.menuContent}</div>
            <div class="${this.menuHandleClass}">
                <span class="${this.menuHandleTitleClass}">${this.menuHandleTitle}</span>
                <span class="${this.dialogMessageClass}">${this.message}</span>
                <svg class="${this.menuHandleInfoTextIconClass}" ... />
            </div>
        </div>

    we override applyNecessaryStyle() to hard-code css attributes to make things behave
    the way we want (grid and flex layout styles). Colors, opacity and the rest are
    up to your external CSS

    attributes:
        * dialogContentClass      <str> default: 'menuContent'
          apply this class to the div containing this.menuContent

        * menuContent           <str> default: ''
          raw html for the menuContent. has an accessor so updating it updates live

        * getMenuContentCallback <Function>
          like getHTMLCallback() but speficically for this.menuContent

        * menuContentCallback   <Function>
          if specified, we call this external function when the value of menuContent is set
          handy for setting up hooks on buttons that might change

        * menuHandleTitleClass  <str> default: 'menuHandleClass'
          apply this class to the div containing the menuHandle

        * menuHandleTitle       <str> default: ${this._className}/${this._version}
          this is the title of the menu displayed on the left-hand side of the menuHandle
          keep it short

        * messageCallback       <Function>
          if specified, we call this external function before changing the value of
          .message in the setter function. If specified, messageCallback must return
          a promise so that we can await its completion before changing the value on screen.
          this is for insertion of jazz-hands.

        * openCallback          <Function>
          like messageCallback, if specified, this function must return a promise, which
          we will await before completing the open() action.

        * closeCallback         <Function>
          same deal for close()

        * minHeight             <str> default: 1em
          when collapsed, the minimum height of the overlay, to show the menuHandle
          the overlay's height is set to this value when close() is called or the object
          is instantiated

        * maxHeight             <str> default: 'auto'
          if specified, the menu will expand to the specified height when open() is called
          the default setting of 'auto' should insure that the entirety of this.menuContent
          is visible.

    attributes from parent class:
        * dialogContentClass   <str> default: 'dialogContentClass'
          apply this class to the visible container div (if using default *.html)

        * dialogMessageClass    <str> default: 'dialogMessageClass'
          apply this class to the element containing *.message (if using default *.html)
          Here, this is the infoText displayed on the right hand side of the menuHandle
          adjascent to the infoTextIcon svg

        * message               <str> default: this._className
          setting this value updates the textContent of the first child with
          class="${this.dialogMessageClass}". If you have overridden the default *.html
          or specified *.getHTMLCallback(), and you  do not have a child with
          class="${this.dialogMessageClass}", you can also specify this.messageDOMElement
          (see below). Here, this is the infoText content

        * messageDOMElement     <Element>
          if this attribute is set, and it is an instance of the DOM Element class, we will
          update textContent of this when *.message is set, rather than looking for the first
          child with class="${this.dialogMessageClass}"

        * showCallback          <Function>
          if specified, we will execute this external callback when the show() function is called
          but before inserting into the visible DOM. Hence the openCallback can abort display
          if it throws.

        * hideCallback         <Function>
          just like showCallback, but we do it when hide() is called.

        * alert                <bool> default: false
          if set true, we append the "alert" class to this.DOMElement, if false we remove it
          this allows you to decorate important messages accordingly in the external CSS

    functions:
        * async setMessage(<str>)
          this returns a promise to change the value of this.message to <str>
          if messageCallback() is defined (see above), we await it's completion
          before changing the value of this.message.

        * async open()
          expand the vertical dimension to reveal menuContent.
          call openCallback() if we have one. This is an async function so openCallback()
          must return a promise such that we can await it (see above)

        * async close()
          collapse the vertical dimension to hide menuContent.
          call closeCallback() if we have one. just like open, this is an async function
          so closeCallback() must return a promise (see above).
*/
class noiceCoreUIHeaderMenu extends noiceCoreUIDialog {


// constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:               1,
        _className:             'noiceCoreUIHeaderMenu',
        _z:                     '990',
        _menuHandleTitle:       '',
        _minHeight:             '1em',
        _maxHeight:             'auto',
        _menuContent:           '',
        isOpen:                 false,
        dialogContentClass:     'menuContent',          // <-- formerly menuContentClass
        menuHandleTitleClass:   'menuHandleTitle',
        menuHandleClass:        'menuHandle',
        menuHandleIconClass:    'menuHandleIcon',
        closedClass:            'menuClosed',
        openClass:              'menuOpen',
        menuContainerClass:     'menuContainer',
        dialogMessageClass:     'menuMessage',         // <-- formerly dialogMessageClass, menuMessageClass
        _html:                  '',
        _message:               ''
    }, defaults);

    // set it up
    super(args, _classDefaults, callback);

    // set default menuHandleTitle to _classname/_version
    if (this.isNull(this.menuHandleTitle)){ this.menuHandleTitle = `${this._className}/${this._version}`; }

} // end constructor


/*
    html getter
*/
get html(){
    let bogus = super.html;
    if (this.hasAttribute('getHTMLCallback') && (this.getHTMLCallback instanceof Function)){
        return(bogus);
    }else{
        return(
            `<div class="${this.menuContainerClass}">
                <div class="${this.dialogContentClass}">${this.menuContent}</div>
                <div class="${this.menuHandleClass}">
                    <span class="${this.menuHandleTitleClass}">${this.menuHandleTitle}</span>
                    <span class="${this.dialogMessageClass}">${this.message}</span>
                    <svg
                        class="${this.menuHandleIconClass}"
                        xmlns="http://www.w3.org/2000/svg"
                        xmlns:xlink="http://www.w3.org/1999/xlink"
                        version="1.1"
                        x="0px"
                        y="0px"
                        width="1em"
                        height="1em"
                        viewBox="0 0 512 512"
                        enable-background="new 0 0 512 512"
                        xml:space="preserve"
                    ><path
                        d="M256 90.002c91.74 0 166 74.2 166 165.998c0 91.739-74.245 165.998-166 166 c-91.738 0-166-74.242-166-165.998C90 164.3 164.2 90 256 90 M256 50.002C142.229 50 50 142.2 50 256 c0 113.8 92.2 206 206 205.998c113.77 0 206-92.229 206-205.998C462 142.2 369.8 50 256 50.002L256 50.002z M252.566 371.808c-28.21 9.913-51.466-1.455-46.801-28.547c4.667-27.098 31.436-85.109 35.255-96.079 c3.816-10.97-3.502-13.977-11.346-9.513c-4.524 2.61-11.248 7.841-17.02 12.925c-1.601-3.223-3.852-6.906-5.542-10.433 c9.419-9.439 25.164-22.094 43.803-26.681c22.27-5.497 59.5 3.3 43.5 45.858c-11.424 30.34-19.503 51.276-24.594 66.9 c-5.088 15.6 1 18.9 9.9 12.791c6.959-4.751 14.372-11.214 19.806-16.226c2.515 4.1 3.3 5.4 5.8 10.1 C295.857 342.5 271.2 365.2 252.6 371.808z M311.016 184.127c-12.795 10.891-31.76 10.655-42.37-0.532 c-10.607-11.181-8.837-29.076 3.955-39.969c12.794-10.89 31.763-10.654 42.4 0.5 C325.577 155.3 323.8 173.2 311 184.127z"
                    /></svg>
                </div>
            </div>`
        );
    }
}


/*
    applyNecessaryStyle (override)
*/
applyNecessaryStyle(){

    // on the main container
    let myNecessaryStyle = {
        display:            'flex',
        justifyContent:     'center',
        alignItems:         'center',
        width:              '100%',
        position:           'absolute',
        left:               '0px',
        top:                '0px',
        height:             this.minHeight,
        overflow:           'hidden',
        paddingBottom:      '.25em',
        zIndex:             900
    };
    Object.keys(myNecessaryStyle).forEach(function(k){ this.DOMElement.style[k] = myNecessaryStyle[k]; }, this);

    // on the menu container
    let necessaryContainerStyle = {
        display:            'grid',
        gridTemplateRows:   `1fr ${this.minHeight}`,
        width:              this.width,
        height:             '100%',
        overflow:           'hidden'
    };
    this.MenuContainerDiv = this.DOMElement.querySelector(`div.${this.menuContainerClass}`);
    Object.keys(necessaryContainerStyle).forEach(function(k){ this.MenuContainerDiv.style[k] = necessaryContainerStyle[k]; }, this);

    // on the menuHandle
    let necessaryHandleStyle = {
        width:          '100%',
        height:         this.minHeight,
        margin:         '0',
        zIndex:         5,
        display:        'flex',
        justifyContent: 'flex-end',
        alignItems:     'center'
    };
    let handle = this.DOMElement.querySelector(`div.${this.menuHandleClass}`);
    Object.keys(necessaryHandleStyle).forEach(function(k){ handle.style[k] = necessaryHandleStyle[k]; }, this);

    // on the menuHandleTitle
    let necessaryHandleTitleStyle = {
        flexGrow:       '1',
        textAlign:      'left'
    }
    let handleTitle = handle.querySelector(`span.${this.menuHandleTitleClass}`);
    Object.keys(necessaryHandleTitleStyle).forEach(function(k){ handleTitle.style[k] = necessaryHandleTitleStyle[k]; }, this);

    // on the menuContentClass
    let necessaryContentStyle = {
        minHeight:        '0',
        zIndex:           '0',
        overflow:         'hidden'
    }
    this.MenuContentDiv = this.DOMElement.querySelector(`div.${this.dialogContentClass}`);
    Object.keys(necessaryContentStyle).forEach(function(k){ this.MenuContentDiv.style[k] = necessaryContentStyle[k]; }, this);

    this.applyNecessaryHooks();
    this.close();
}


/*
    applyNecessaryHooks()
    after super.render() and after applyNecessaryStyle
    we need to set up necessary hooks.
*/
applyNecessaryHooks(){
    /*
        in this case, the click on the menuHandle
        to hide/show the menuContent
    */
    let that = this;
    this.DOMElement.querySelector(`div.${this.menuHandleClass}`).addEventListener("click", function(evt){
        if (that.isOpen){ that.close(); }else{ that.open(); }
    });
}


/*
    getter and setter for _menuHandleTitle
*/
get menuHandleTitle(){ return(this._menuHandleTitle); }
set menuHandleTitle(str){
    this._menuHandleTitle = str;
    this.DOMElement.querySelector(`.${this.menuHandleTitleClass}`).textContent = this.menuHandleTitle;
}


/*
    getter and setter for _minHeight
*/
get minHeight(){ return(this._minHeight); }
set minHeight(str){
    this._minHeight = str;
    if (! this.isOpen){ this.height = this.minHeight; }
}


/*
    getter and setter for _maxHeight
*/
get maxHeight(){ return(this._maxHeight); }
set maxHeight(str){
    this._maxHeight = str;
    if (this.isOpen){ this.height = this.maxHeight; }
}


/*
    getter and setter for _menuContent
*/
get menuContent(){
    if (this.hasAttribute('getMenuContentCallback') && (this.getMenuContentCallback instanceof Function)){
        return(this.getMenuContentCallback(this));
    }else{
        return(this._menuContent);
    }
}
set menuContent(str){

    /*
        NOTE: if you've defined getMenuContentCallback, we're basically ignoring anything you send us
        here, and we're just gonna insert whatever the external callback gave us when we call this.menuContent

        I mean, we'll shoot str into _menuContent anyhow, but we're not inserting it into the html here.
    */
    this._menuContent = str;
    this.DOMElement.querySelector(`div.${this.dialogContentClass}`).innerHTML = this.menuContent;
    let that = this.DOMElement.querySelector(`div.${this.dialogContentClass}`);
    if (this.hasAttribute('menuContentCallback') && (this.menuContentCallback instanceof Function)){
        this.menuContentCallback(that);
    }
}
get menuContentDOMElement(){
    return(this.DOMElement.querySelector(`div.${this.dialogContentClass}`));
}

get message(){ return(this._message); }
set message(msg){
    if (this.hasAttribute('messageCallback') && (this.messageCallback instanceof Function)){
        this.messageCallback(msg);
    }else{
        this._message = msg;
        if (this.hasAttribute('messageDOMElement') && (this.messageDOMElement instanceof Element)){
            this.messageDOMElement.textContent = this.message;
        }else{
            this.DOMElement.querySelector(`.${this.dialogMessageClass}`).textContent = this.message;
        }
    }
}


/*
    setMessage(message)
    this function returns a promise to set the value of .message
    if messageCallback is set, we await that before changing the
    value of .message

    --> insert jazzhands here <--
*/
async setMessage(msg){
    if (this.hasAttribute('messageCallback') && (this.messageCallback instanceof Function)){
        await this.messageCallback(msg);
    }

    /*
        11/23/18 @ 1254
        ok fuckit, apparently parent class setter for this.message no longer executes
        as a mater of fact, if you override it and put a setter right here it still won't
        I do not know wtf

        11/26/18 @ 1441 -- UPDATE
        this happened because we didn't prune attributes with getters and setters from the args
        sent to super.constructor(). So the super constructor made a hard attribute which overrode
        the child class getter/setter.

        this should be fixed now, but I've already implemented a workaround below so why not roll with it?
    */
    //this.changeMessage(msg);
    this.message = msg;
}
/*
changeMessage(msg){
    this.DOMElement.querySelector(`.${this.dialogContentClass}`).textContent = msg;
    this._message = msg;
}
*/


/*
    open() -- async
*/
async open(){
    let that = this;
    if (this.hasAttribute('openCallback') && (this.openCallback instanceof Function)){ await that.openCallback(that); }
    this.DOMElement.classList.remove(this.closedClass);
    this.DOMElement.classList.add(this.openClass);
    this.isOpen = true;

    setTimeout(function(){
        that.height = that.maxHeight;
    }, 1);
}


/*
    close() -- async
*/
async close(){
    let that = this;
    if (this.hasAttribute('closeCallback') && (this.closeCallback instanceof Function)){ await that.closeCallback(that); }

    this.DOMElement.classList.remove(this.openClass);
    this.DOMElement.classList.add(this.closedClass);
    this.isOpen = false;
    setTimeout(function(){that.height = that.minHeight;}, 1);

}


} // end noiceCoreUIHeaderMenu class




/*
    noiceCoreUIScreen
    this extends noiceCoreUIOverlay to define a UIScreen

    inheriting from CoreUIOverlay gives us a full width/height
    div with a z-index into which *.html will be inserted as a
    flex object.

    attributes:
        * name              <str>  default: this._className

        * focus             <bool> default: false (read-only)
          a UIScreen object defines a boolean state of "focus". When inside a UIScreenHolder,
          only one UIScreen may have the display at once. In that context, 'focus', means
          that the object has the display inside the parent UIScreenHolder. More generically,
          the concept of 'focus' is more arbitrary in that it may or may not control if the
          object is visible, however, changing this state invokes the focusCallback() (if
          specified).

        * focusCallback     <Function>
          if specified, this external function is invoked when the value of this.focus
          changes via this.setFocus(<bool>). This function may cancel the requested change to
          this.focus by throwing. The new value of bool is passed as an argument to the
          external function. This function must return a promise.

    functions:
        * async setFocus(<bool>)

*/
class noiceCoreUIScreen extends noiceCoreUIOverlay {


// minimal constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:           1,
        _className:         'noiceCoreUIScreen',
        focus:              false
    }, defaults);

    // this one will just take a string as the only arg if that's how you call it ...
    let useArgs = ((args instanceof Object)?args:{});
    if (! (args instanceof Object)){ useArgs.message = args; }

    // set it up
    super(args, _classDefaults, callback);

    // set default name
    if (! this.hasAttribute('name')){ this.name = this._className; }
}


/*
    setFocus(<bool>)
*/
async setFocus(bool){
    let tmp = false;
    if (bool === true){ tmp = true; }
    if (this.hasAttribute('focusCallback') && (this.focusCallback instanceof Function)){
        let that = this;
        await this.focusCallback(tmp).catch(function(e){
            throw(new noiceException({
                message:        `focusCallback() threw an error preventing setFocus(${tmp}): ${e.toString()}`,
                messageNumber:    104,
                thrownBy:       `${that._className}/setFocus(${tmp})`
            }));
        });
    }
    this.focus = tmp;
}

} // end noiceCoreUIScreen class




/*
    noiceCoreUIScreenHolder
    this is a holder for noiceCoreUIScreen descendants.
    the object contains a number of coreUIScreen objects
    only one of which is visible (has focus) at a time.

    attributes:
        * UIList            <Object> default: {}
        * currentUI:        <string>


    functions:
        * switchUI(<uiName>)
        * addUI(<coreUIScreenObject>, <uiName>)
        * removeUI(<uiName>)
        * listUIs()

*/
class noiceCoreUIScreenHolder extends noiceCoreUIOverlay {


// minimal constructor
constructor(args, defaults, callback){
    let _classDefaults = noiceObjectCore.mergeClassDefaults({
        _version:           1,
        _className:         'noiceCoreUIScreenHolder',
        _defaultUI:         '',
        _showDefaultUI:     false,
        UIList:            {},
        _html:              ''
    }, defaults);

    // set it up
    super(args, _classDefaults, callback);

    // tag it with a timestamp if it doesn't have one
    if (! this.hasOwnProperty('time')){ this.time = this.epochTimestamp(true); }
}

/*
    null html getter
*/
get html(){ return(''); }

/*
    addUI(<coreUIScreenObject>, <uiName>)
    if uiName, not given, we will use coreUIScreenObject.name
*/
addUI(screen, screenName){
    if (this.isNull(screen) || (!(screen instanceof noiceCoreUIScreen))){
        throw(new noiceException({
            message:        `specified screen is not an instance of noiceCoreUIScreen`,
            messageNumber:   105,
            thrownBy:       `${that._className}/addUI`
        }));
    }
    let useName = screenName;
    if (this.isNull(useName)){ useName = screen.name; }
    if (screen.onScreen){ screen.remove(); }
    this.UIList[useName] = screen;
}



/*
    removeUI(<uiName>)
    returns a reference to the removed UI
*/
removeUI(screenName){
    if (this.isNull(screenName) || (! this.UIList.hasOwnProperty(screenName))){
        throw(new noiceException({
            message:        `holder does not contain specified ui (${screenName})`,
            messageNumber:   106,
            thrownBy:       `${that._className}/removeUI`
        }));
    }
    let tmp = this.UIList[screenName];
    delete this.UIList.screenName;
    return(tmp);
}


/*
    switchUI(<uiName>)
    give the ui with the specified <uiName> focus and
    unfocus all others
*/
async switchUI(screenName){
    if (this.isNull(screenName) || (! this.UIList.hasOwnProperty(screenName))){
        throw(new noiceException({
            message:        `holder does not contain specified ui (${screenName})`,
            messageNumber:   106,
            thrownBy:       `${this._className}/switchUI`
        }));
    }

    /*
        its the old DOM switcheroo!
    */

    // await unsetting the one that has focus if there is one, then hide it
    if (this.hasAttribute('currentUI')){
        await this.UIList[this.currentUI].setFocus(false);
        this.UIList[this.currentUI].remove();
        this.currentUI = '';
    }

    // await setting focus on the specified one then unhide it
    await this.UIList[screenName].setFocus(true);
    this.UIList[screenName].append(this.DOMElement);
    this.currentUI = screenName;
}


/*
    listUIs()
*/
listUIs(){ return(Object.keys(this.UIList)); }


} // end noiceCoreUIScreenHolder class



/*
    noiceCoreUIFloatingDialog
    this is an absolutely positioned high z-index div containing
    a "handle" and a body. Both could be anything you like but
    with some basic css this makes the classic "title bar" / "window"
    UI which is draggable within it's parent's dimensions.

    This makes a good control panel, or non-modal dialog (see examplea)
*/
class noiceCoreUIFloatingDialog extends noiceCoreUIOverlay {

    /*
        In Memorium 3/7/2020 @ 2105
        C-Ba$$ died, curled up in his favorite spot, with his head burried in my
        blanket. He was a good, good cat. I miss him already.
        I guess I'm working on this right now as an avoidance mechanism.
        let's at least try to let it be a productive one.
    */

/*
    constructor({
        title:      <string for the handle, keep it short>
        html:      this works exactly like in the parent class, but it's the 'body' section of the dialog
                    ... yadda yadda yadda, see the documentation for noiceCoreUIElement
                    (above, in the comments ... 'cause I rolls like that ...'),
        width:      <pixels is the default but it's passed to element.style.width so ...>
        height:     <same deal>
        left:       <initial x coordinate, but again, same note as above, anything csslegal is legal>
        top:        <initial y coordinate
    })
*/

constructor (args, defaults, callback){
    super(args, noiceObjectCore.mergeClassDefaults({
        _version:           1,
        _className:         'noiceCoreUIFloatingDialog',
        _width:             (window.innerWidth/10),
        _height:            (window.innerHeight/5),
        _x:                 (window.innerWidth/10),
        _y:                 (window.innerHeight/5),
        _z:                 1000,
        _bodyHTML:          '<p>[dialog content goes here]</p>',
        classList:          ['ncufDialog'],
        dialogHandleClass: 'ncfuDialogHandle',
        dialogBodyClass:   'ncfuDialogBody'
    }), callback);

    if (! this.hasAttribute('_title')){ this._title = `${this._className} (v${this._version})`; }

    /*
        NOTE: the parent class constructor called render() and renderCallback() for us
        so now we're just gonna apply the hard-coded css styles to this.DOMElement right here
        but we're going to do it in the applyNecessaryStyle() function so that extension
        classes can override it
    */


    this.applyNecessaryStyle();
    this.setup();
}


/*
    applyNecessaryStyle()
    apply hard-coded css attributes
*/
applyNecessaryStyle(){
    let myNecessaryStyle = {
        position:       'absolute',
        overflow:       'hidden',
        display:        'grid',
        grid:           '1fr',
        justifyContent: this.justifyContent,
        alignItems:     this.alignItems,
        width:          this.width,
        height:         this.height,
        left:           this.x,
        top:            this.y,
        zIndex:         this.z
    }
    Object.keys(myNecessaryStyle).forEach(function(k){ this.DOMElement.style[k] = myNecessaryStyle[k]; }, this);
}

/*
    getter and setter for x,y
*/
get x(){ return(this._x); }
set x(val){
    this._x = val;
    if (this.DOMElement instanceof Element){
        this.DOMElement.style.left = `${this.x}px`;
    }
}
get y(){ return(this._y); }
set y(val){
    this._y = val;
    if (this.DOMElement instanceof Element){
        this.DOMElement.style.top = `${this.y}px`;
    }
}

/*
    getter and setter for title
*/
get title(){ return(this._title); }
set title(val){
    this._title = val;
    if (this.hasAttribute('dialogTitleMessageDOMElement')){
        this.dialogTitleMessageDOMElement.textContent = val;
    }
}


/*
    getter and setter for body
*/
get bodyHTML(){ return(this._bodyHTML); }
set bodyHTML(val){
    this._bodyHTML = val;
    if (this.hasAttribute('dialogTitleMessageDOMElement')){
        this.dialogBodyDOMElement.innerHTML = val;
    }
}


/*
    override ,html getter and setter
*/
get html(){
    return(`
        <div class="${this.dialogHandleClass}"><h3>${this.title}</h3></div>
        <div class="${this.dialogBodyClass}">${this.bodyHTML}</div>
    `);
}
set html(val){
    this._bodyHTML = val;
    this._html = this.html;
    if (this.hasOwnProperty('DOMElement')){ this.update(); }
}

/*
        setup the dragging and stuff ....
*/
setup(){
    this.dialogHandleDOMElement = this.DOMElement.querySelector(`.${this.dialogHandleClass}`);
    this.dialogTitleMessageDOMElement = this.dialogHandleDOMElement.querySelector(`h3`);
    this.dialogBodyDOMElement = this.DOMElement.querySelector(`.${this.dialogBodyClass}`);

    let that        = this;
    let click       = [0, 0];
    let position    = [0, 0];
    let ctrl        = this.DOMElement;
    let handle      = this.DOMElement.querySelector(`.${this.dialogHandleClass}`);

    /*
        TO-DO: implement a bool property that toggles between
        ctrl & handle for the listeners.
    */

    // toggle the body hook
    let body = this.dialogBodyDOMElement;
    /*
    handle.addEventListener('dblclick', function(evt){
        if (body.style.display == 'none'){
            body.style.display = 'block';
        }else{
            body.style.display = 'none';
        }
    });
    */




    // start drag / click down
    handle.addEventListener('mousedown', clickIt);
    handle.addEventListener('touchstart', clickIt);

    // end drag / click up
    handle.addEventListener('mouseup', releaseIt);
    handle.addEventListener('touchend', releaseIt);

    // click it
    function clickIt(e){
        e = e || window.event;
        e.preventDefault();
        let last = e.target.dataset.lastClick || 0;
        e.target.dataset.lastClick = that.epochTimestamp(true);

        if ((e.target.dataset.lastClick - last) < 300){
            if (body.style.display == 'none'){
                body.style.display = 'block';
            }else{
                body.style.display = 'none';
            }
        }

        ctrl.classList.add('activeDrag');
        position        = [ctrl.offsetLeft, ctrl.offsetTop];
        click           = [e.clientX, e.clientY];

        // handle it for touch stuff
        if ((e.changedTouches && e.changedTouches.length > 0)){
            click = [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
        }
        that.DOMElement.parentElement.addEventListener('mousemove', dragIt);
        that.DOMElement.parentElement.addEventListener('touchmove', dragIt);
    }

    // drag it
    function dragIt(e){
        e = e || window.event;
        e.preventDefault();

        let ptrX = e.clientX;
        let ptrY = e.clientY;

        if ((e.changedTouches && e.changedTouches.length > 0)){
            ptrX = e.changedTouches[0].clientX;
            ptrY = e.changedTouches[0].clientY;
        }

        window.requestAnimationFrame(function(){
            ctrl.style.left = `${(ptrX - click[0]) + position[0]}px`;
            ctrl.style.top = `${(ptrY - click[1]) + position[1]}px`;
        });
    }

    // release it
    function releaseIt(e){
        ctrl.classList.remove('activeDrag');
        that.DOMElement.parentElement.removeEventListener('mousemove', dragIt);
        that.DOMElement.parentElement.removeEventListener('touchmove', dragIt);
    }

    // initial coordinates
    this.x = this.x;
    this.y = this.y;
    /*
        renderCallback() should be able to set hooks on your dialog content
    */
}

}



/*
    noiceCoreUIDropdown
*/
class noiceCoreUIDropdown extends noiceCoreUIElement {

/*
    constructor({
        label:          <str>,

        embedLabel:     <bool> (default false)
                        does not render a <label> element, but places the label value
                        as the first, default value but not selectable option of the menu

        values:         <obj> || <array>,
                        list of values for the menu.
                        the list can be flat strings or objects of the format value:displayValue

        selectedValue:  <str>   the value of the currently selected option
    })
*/
constructor(args, defaults, callback){
    super(args, noiceObjectCore.mergeClassDefaults({
        _version:                           1,
        _className:                         'noiceCoreUIDropdown',
        _values:                            [],
        _selectedValue:                     '',
        _enable:                            true,
        _label:                             '',
        _embedLabel:                        false,
        classList:                          ['ncuDropdown', 'ncuFormElement'],
        labelClass:                         'ncuFormElementLabel',
        embeddedLabelClass:                 'ncuFormElementLabelEmbdedded',
        embededLabelDefaultSelectionClass:  'ncuFormElementDefaultSelect'
    }, defaults), callback);

    if (! this.hasAttribute('_name')){ this._name = this._label; }


    /*
        might wanna put some hard-coded renderCallback in here or something
    */
    this.setup();

} // end constructor


/*
    needed getters and setters
        * embedLabel
*/
get label(){ return(this._label); }
set label(val){
    this._label = val;
    if (this.hasAttribute('labelDOMElement')){ this.labelDOMElement.textContent = this.label; }
}
get name(){ return(this._name); }
set name(val){
    this._name = val;
    if ((! this.hasAttribute('selectDOMElement')) && (this.hasAttribute('DOMElement'))){ this.selectDOMElement = this.DOMElement.querySelector('select'); }
    if (this.hasAttribute('selectDOMElement')){ this.selectDOMElement.setAttribute('name', this.name); }
}
get values(){ return(this._values); }
set values(val){
    // val must be an array of strings or objects of the form:  <value>:<displayValue>
    this._values = val;
    if (this.hasOwnProperty('DOMElement')){ this.updateOptions(); }
}
get selectedValue(){
    if (this.hasAttribute('selectDOMElement')){ this._selectedValue = this.selectDOMElement.value; }
    return(this._selectedValue);
}
set selectedValue(val){
    this._selectedValue = val;
    if (this.hasAttribute('selectDOMElement')){
        this.selectDOMElement.value = this._selectedValue;
    }
}
get hasValue(){ return(this.isNotNull(this.selectedValue)); }
get enable(){ return(this._enable); }
set enable(bool){
    this._enable = (bool === true);
    if (this.hasAttribute('selectDOMElement')){ this.selectDOMElement.disabled = (! this._enable); }
}

get embedLabel(){ return(this._embedLabel); }
set embedLabel(bool){
    let newState = (bool === true);
    if (this.hasAttribute('selectDOMElement')){
        // hide or show the label element
        if (this.hasAttribute('labelDOMElement')){
            this.labelDOMElement.style.display = (! newState)?null:'none';
        }

        // if we are moving into an embedded label state, add to the top of the options list
        if (newState && (! this._embedLabel)){
            // if we don't have one, make it
            if (! this.hasAttribute('_embeddedLabelOptionElement')){ this._embeddedLabelOptionElement = document.createElement('option'); }
            this._embeddedLabelOptionElement.disabled      = true;
            this._embeddedLabelOptionElement.value         = '_defaultLabel';
            this._embeddedLabelOptionElement.text          = this.label;
            this._embeddedLabelOptionElement.selected      = true;
            this._embeddedLabelOptionElement.classList.add(this.embeddedLabelClass);
            this.selectDOMElement.add(this._embeddedLabelOptionElement, 0);

        // if we are moving into a normal state from an embedded state
        }else if ((! newState) && this._embedLabel){
            this.selectDOMElement.remove(0);
            delete(this._embeddedLabelOptionElement);
        }
        this.setStylesBySelection(this.selectedValue);
    }
    this._embedLabel = newState;
}

/*
    override ,html getter and setter
*/
get html(){
    if (! this.hasAttribute('formElementGUID')){ this.formElementGUID = this.getGUID(); }

    return(`
        <label for="${this.formElementGUID}" class="${this.labelClass}">${this.label}</label>
        <select id="${this.formElementGUID}" name="${this.name}" ${(this.enable)?'enabled':'disabled'}></select>
    `);
}

set html(val){
    this._bodyHTML = val;
    this._html = this.html;
    if (this.hasOwnProperty('DOMElement')){ this.update(); }
}


/*
    updateOptions()
*/
updateOptions(){

    if (! this.hasAttribute('selectDOMElement')){ return(false); }

    // clear out the old ones (PS: )
    let tmp = this.selectDOMElement.options.length;                     // <-- <select>.options is a live list -- lesson learned
    for (let i=0; i < tmp; i++ ){ this.selectDOMElement.remove(0); }

    // insert the new ones
    this.values.forEach(function(o){
        let t = document.createElement("option");
        t.disabled = false;
        if (typeof(o) == "object"){

            /* <value>:<displayValue> */
            t.value    = Object.keys(o)[0];
            t.text     = o[t.value];
            t.selected = (this.hasValue && (this.selectedValue == t.value || this.selectedValue == t.text));

        }else if (typeof(o) == "string"){
            t.value    = o;
            t.text     = o;
            t.selected = (this.hasValue && this.selectedValue == t.value);
        }
        this.selectDOMElement.add(t);
    }, this);
    return(true);
}

/*
    setStylesBySelection(newValue, oldValue)
    this is fired on value select. this handles setting unsetting
    the default status style when the label is embedded too
*/
setStylesBySelection(newValue, oldValue){

    // handle toggling the embedded label default selection class
    if (newValue == '_defaultLabel'){
        this.selectDOMElement.classList.add(this.embededLabelDefaultSelectionClass);
    }else{
        this.selectDOMElement.classList.remove(this.embededLabelDefaultSelectionClass);
    }

    /*
        ya might wanna override this and do some things here
    */

}


/*
    selectHandler(event)
    this catches event changes on the menu (i.e. someone clicked it and chose a new value)
*/
selectHandler(evt){
    /*
        you could put additional stuff here
        but the callback can't cancel it
    */

    // the main thing is the selectCallback which gets executed here if you set it. like this
    if (this.hasAttribute('selectCallback') && (this.selectCallback instanceof Function)){
        try {
            // (new, old) -- abort by throwing in there
            this.selectCallback(evt.target.value, this._selectedValue);
        }catch(e){
            throw(new noiceException({
                message:        `${this._className}/selectHandler -> callback threw an error: ${e.toString()}`,
                messageNumber:   420,
                thrownBy:       `${this._className}/selectHandler (callback)`
            }));
        }
    }

    // set properties based on select (one of which might be default select embedded label thing)
    this.setStylesBySelection(evt.target.value, this._selectedValue);

    this._selectedValue = evt.target.value;
} // end selectHandler


/*
    setup
*/
setup(){

    /*
        snag all the important DOM Elements
    */
    this.selectDOMElement = this.DOMElement.querySelector(`#${this.formElementGUID}`);
    this.labelDOMElement = this.DOMElement.querySelector('label');

    /*
        fire DOM updates that need to happen once, on initial display
    */
    this.updateOptions();
    this.label = this._label;

    /*
        attach the event listener for value change
    */
    let that = this;
    this.selectDOMElement.addEventListener('input', function(e){ that.selectHandler(e); });
}

} // end noiceCoreUIDropdown


/*
    noiceCoreUIDropdown
*/
class noiceCoreUIInput extends noiceCoreUIDropdown {

/*
    it occurs both of these should descend from a common parent
    class that handles all the label shit, but for now, we plow ahead
*/

constructor(args, defaults, callback){
    super(args, noiceObjectCore.mergeClassDefaults({
        _version:                           1,
        _className:                         'noiceCoreUIInput',
        _values:                            [],
        _selectedValue:                     '',
        _enable:                            true,
        _label:                             '',
        _embedLabel:                        false,
        classList:                          ['ncuInput', 'ncuFormElement'],
        labelClass:                         'ncuFormElementLabel',
        embeddedLabelClass:                 'ncuFormElementLabelEmbdedded',
        embededLabelDefaultSelectionClass:  'ncuFormElementDefaultSelect'
    }, defaults), callback);

    if (! this.hasAttribute('_name')){ this._name = this._label; }


    /*
        might wanna put some hard-coded renderCallback in here or something
    */
    this.setup();
} // end constructor


/*
    override ,html getter and setter
*/
get html(){
    if (! this.hasAttribute('formElementGUID')){ this.formElementGUID = this.getGUID(); }

    return(`
        <label for="${this.formElementGUID}" class="${this.labelClass}">${this.label}</label>
        <input id="${this.formElementGUID}" name="${this.name}" ${(this.enable)?'enabled':'disabled'}></input>
    `);
}


/*
    selectHandler(event)
    this catches event changes on the menu (i.e. someone clicked it and chose a new value)
*/
selectHandler(evt){
    // the callback --> note it's getting called for every keypress.
    if (this.hasAttribute('inputCallback') && (this.inputCallback instanceof Function)){
        try {
            // (new, old) -- abort by throwing in there
            this.inputCallback(evt.target.value, this._selectedValue);
        }catch(e){
            throw(new noiceException({
                message:        `${this._className}/selectHandler -> callback threw an error: ${e.toString()}`,
                messageNumber:   420,
                thrownBy:       `${this._className}/selectHandler (callback)`
            }));
        }
    }

    this._selectedValue = evt.target.value;
}

get value(){
    // lort ...
    return(this.selectedValue);
}
set value(val){
    // <snicker> ...
    this.selectedValue = val;
}

/*
    setup
*/
setup(){

    /*
        snag all the important DOM Elements
    */
    this.selectDOMElement = this.DOMElement.querySelector(`#${this.formElementGUID}`);
    this.labelDOMElement = this.DOMElement.querySelector('label');

    /*
        fire DOM updates that need to happen once, on initial display
    */
    this.label = this._label;

    /*
        attach the event listener for value change
    */
    let that = this;
    this.selectDOMElement.addEventListener('input', function(e){ that.selectHandler(e); });
}

}
