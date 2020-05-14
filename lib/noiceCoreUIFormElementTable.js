/*

    noiceCoreUIFormElementTable
    fancy-ass tables.

    status as of 5/1/2020:

        Implemented
            * column resize via touch gesture on header
            * column drag via touch gesture and mouse click/drag
            * sort by single click on column header (asc, desc, no sort)
            * multi-column sort (prescidence by order of click on column header)
            * pagination
            * external async callback on pagination page change allows fetch content from server
            * row selection (single, multiple or a set number -- rows are deselected in reverse click order)
            * external callback on row selection
            * external callback for alternate sort criteria

        To-Do
            * visual feedback on column drag
            * nuanced column drag by edge detection
            * desktop resize column by edge drag
            * built-in CSV export
            * editable cells
            * for real documentation
*/
class noiceCoreUIFormElementTable extends noiceCoreUIFormElement {


/*
    constructor({
        columns:        <array>    column header values
        rows:           <array>    of arrays (or objects) representing rows
        sortCallback    <function> this is a javascript compare function as described here:
                                   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
                                   first and second value arguments are pointers to objects or arrays representing rows.
                                   so, for whatever goofy-ass kinda sort you can dream up -- it's all right there.
                                   if not specified, the default sort does alphabetical ascending on the first column.
        _selectMode    <str|num>   this is either the maximum number of rows that can be selected, or one of the following
                                   string values:
                                    'none'      -> selection disabled (so 0)
                                    'single'    -> single row can be selected (so 1)
                                    'multiple'  -> unlimited selections


    })
*/
constructor(args, defaults, callback){
    super(args, noiceObjectCore.mergeClassDefaults({
        _version:               1,
        _className:             'noiceCoreUITable',
        _selectMode:            'single',
        _captureValueOn:        'rowSelect',
        _selectionList:         [],
        _columns:               [],
        _rows:                  [],
        _selectOrderIndex:      0,
        _maxRows:               0,
        _pageNumber:            1,
        _numPages:              0,
        _message:               '',
        _showControlPanel:      true,
        _columnOrder:           [],
        _colWidths:             [],
        _stickyHeader:          false,
        _maxHeight:             null,
        _columnIndex:           {},
        _headerDragListeners:   {},
        tableClass:             'ncfuTable',
        tableContainerClass:    'ncfuTableContainer',
        controlPanelClass:      'ncfuTableControlPanel',
        messageClass:           'ncfuTableMessage',
        lastPageBtnClass:       'ncfuLastPageButton',
        lastPageBtnLabel:       '< previous',
        nextPageBtnClass:       'ncfuNextPageButton',
        nextPageBtnLabel:       'next >',
        columnDragAvatarClass:  'ncfuTableHeaderDragAvatar',
        columnEdgeThreshold:    .2,
        dragging:               false
    }, defaults), callback);

} // end constructor

/*
    insert overrides
        - [done] get html()
        - get value()
        - set value(v)
        - set captureValueOn(v)
        - resetCaptureHooks()
        - captureValue()

    functions
        - addRow
        - removeRow
        - moveRow
        - addColumn
        - removeColumn
        - moveRow
        - sort
        - clear
        - selectRow
        - selectAll
        - selectNone
        - export
*/

/* columns */
get columns(){ return(this._columns); }
set columns(v){
    /*
        this is the data structure we accept for columns.
        an array of objects containing these attributes:
            * name (required & unique)
            * label (optional, display this instead of name)
    */

    this._columns = v;
    this._columnOrder = [];
    this._columnIndex = {};
    this._columns.forEach(function(t){
        this._columnOrder.push(t.name);
        this._columnIndex[t.name] = t;
    }, this);
}
get columnOrder(){ return(this._columnOrder); }
set columnOrder(v){ this._columnorder = v; }
get columnIndex(){ return(this._columnIndex); }
addColumn(col, idx){
    if (! isNaN(parseInt(idx,10))){
        this._columns.splice(parseInt(idx,10),col);
    }else{
        this._columns.push(col)
    }

    /*
        LOOSE END 4/22/20 @ 1612

        addColumn has not been tested and we need a way
        of updating the UI from here.

        at the moment I'm in the middle of click-handling for
        the column headers, so I'll have to get back to this ...
    */

}


/* rows */
get rows(){ return(this._rows); }
set rows(v){

    /* rows must be an array of objects */
    if (! (v instanceof Array)){
        throw(new noiceException({
            message:        `${this._className}/rows (setter): invlalid (value must be an array of objects)`,
            messageNumber:   420,
            thrownBy:       `${this._className}/rows (setter)`
        }));
    }

    this._rows = [];
    v.forEach(function(rowData, idx){
        this._rows.push(this.renderRow(rowData));
    }, this);

}

/*
    renderRow
*/
renderRow(data){

    // data must be an object
    if (! (data instanceof Object)){
        throw(new noiceException({
            message:        `${this._className}/renderRow: invlalid (value must be an array of objects)`,
            messageNumber:   420,
            thrownBy:       `${this._className}/renderRow`
        }));
    }

    // make the row element
    let row = document.createElement('tr');
    row.dataset.selected = 'false';

    /*
        dataset.meta
        every key on the row data object that doesn't
        have a corresponding row is stringified into JSON
        and stored on this dataset attribute. This provides
        access to rowSelectCallback() to the complete row data
        not just the columns displayed in the table
    */
    let metaTmp = {};
    Object.keys(data).forEach(function(key){
        if (!(this.columns.indexOf(key) >= 0)){ metaTmp[key] = data[key]; }
    }, this);
    if (Object.keys(metaTmp).length > 0){
        row.dataset.meta = JSON.stringify(metaTmp);
    }

    /*
        append cells with column to row
    */
    this.columns.forEach(function(col,idx){
        let cell = document.createElement('td');
        if (data.hasOwnProperty(col.name)){
            cell.textContent = data[col.name];
            cell.headers = col.DOMElement.id;
        }
        row.append(cell);
    });

    // hang the row select hook on the row
    let that = this;
    row.addEventListener('click', function(e){ that.handleRowSelect(e); }, false);

    // and return it
    return(row);
}


/*
    addRow({row}, bool)
    {row} is an object reference containing data for the row
    if bool is true, we'll call renderTableContent() after adding
    the row. If false we won't
*/
addRow(row, updateFlag){
    this._rows.push(this.renderRow(row));
    if (updateFlag){ this.renderTableContent(); }
}


/*
    renderHeader
    blow away the header and build it
*/
renderHeader(){

    if (! this.hasFormElement){ return(false); }

    // baleted!
    if (this.headerDOMElement instanceof Element){
        this.formElement.removeChild(this.headerDOMElement);
    }

    // spawn the header row
    this.headerDOMElement = document.createElement('thead');
    let tr = document.createElement('tr');

    // spawn the columns
    this.columns.forEach(function(col,idx){
        col.DOMElement = document.createElement('th');
        col.DOMElement.textContent = (this.isNotNull(col.label))?col.label:col.name;
        if (col.hasOwnProperty('width')){ col.DOMElement.style.width = col.width; }

        col.DOMElement.id    = this.getGUID();
        col.DOMElement.scope = 'col';

        // column logical properties
        col.DOMElement.dataset.name           = col.name;
        col.DOMElement.dataset.label          = (this.isNotNull(col.label))?col.label:col.name;
        col.DOMElement.dataset.order          = idx;
        col.DOMElement.dataset.selected       = 'false';
        col.DOMElement.dataset.sort           = 'none';
        col.DOMElement.dataset.sortMode       = (col.hasOwnProperty('sortMode'))?(col.sortMode):'string';

        this.hangHeaderColumnHooks(col);

        tr.append(col.DOMElement);
    }, this);
    this.hangHeaderRowHooks(tr);

    this.headerDOMElement.append(tr);
    this.formElement.append(this.headerDOMElement);
    return(this.headerDOMElement);
}


/*
    moveColumn(<colName>,<position>,<edge>)
    move the column specified by columnName from it's
    current position to the specified <position>
    (zero-indexed)

    LOOSE END: come back and put throws in on the exeptions
*/
moveColumn(columnName, index, edge){

    // current position / validate columnName
    let currentPosition = this.columnOrder.indexOf(columnName);
    if (currentPosition < 0){
        // error bad columnName
        console.log(`bad columnName: ${columnName}`)
        return(false);
    }

    // new position / validate index
    let newPosition = parseInt(index, 10);
    if (isNaN(newPosition) || (newPosition < 0) || (newPosition > (this.columns.length -1))){
        // error bad new position index
        console.log(`bad position: ${idx} / ${newPosition}`)
        return(false)
    }

    // remove element from position array, and re-insert it at specified position
    let tmp = this._columns[currentPosition];
    this._columns.splice(currentPosition, 1);
    this._columns.splice(newPosition, 0, tmp);
    this._columnOrder = [];
    this._columnIndex = {};
    this._columns.forEach(function(t){
        this._columnOrder.push(t.name);
        this._columnIndex[t.name] = t;
    }, this);


    let hdr = this.headerDOMElement.querySelectorAll('tr th')[currentPosition];
    this.headerDOMElement.querySelector('tr').removeChild(hdr);

    /*
        ok, look this is a loose end.
        there's something wonky with the damn positioning
        LOOSE END 5/1/2020 @ 1611
        the below seems like it should work but does not.
        I dunno man.

        if (edge == 'right'){``
            if (newPosition == (this.columns.length - 1)){
                this.headerDOMElement.querySelector('tr').append(hdr);
                this.rows.forEach(function(row, idx){
                    let cell = row.querySelectorAll('td')[currentPosition];
                    row.removeChild(cell);
                    row.append(cell);
                });
            }else{
                newPosition ++;
            }
        }
    */
    let target = this.headerDOMElement.querySelectorAll('tr th')[newPosition];

    // swap the header
    this.headerDOMElement.querySelector('tr').insertBefore(hdr, target);

    // swap all of the cells (on screen or not)
    this.rows.forEach(function(row, idx){
        let cell = row.querySelectorAll('td')[currentPosition];
        let target = row.querySelectorAll('td')[newPosition];
        row.removeChild(cell);
        row.insertBefore(cell, target);
    }, this);
}

/*
    doColumnSort();
    descends the table header, scoops up everyone's sort state
    then orders the sort preferences by click order
    then applies them
*/
doColumnSort(){
    let list = [];
    this.formElement.querySelectorAll('thead tr th').forEach(function(col, idx){
        if ((col.dataset.sort == 'ascending') || (col.dataset.sort == 'descending')){ list.push(col); }
    });
    let sortOptions = [];
    list.sort(function(a,b){ return(a.dataset.lastClick - b.dataset.lastClick);}).forEach(function(hdr){
        sortOptions.push({
            columnName:     hdr.dataset.name,
            descending:     (hdr.dataset.sort == 'descending'),
            sortMode:       hdr.dataset.sortMode
        });
    });

    this.sort(sortOptions);
}

/*
    colWidths getter
    set the widths of the columns in css syntax by position
    in the given array. literally whatever you send, we'll try
    to blindly pipe into *.style.width
*/
get colWidths(){
    if (this.hasFormElement){
        let colWidths = [];
        this.formElement.querySelectorAll('thead tr th').forEach(function(col, idx){
            colWidths.push(col.clientWidth);
        }, this);
        return(colWidths);
    }else{
        return(this._colWidths);
    }
}

/*
    renderTableContent
    blow away the table body, build it agan and re-insert it
*/
renderTableContent(){
    if (! this.hasFormElement){ return(false); }


    // setup the <tbody> element if we don't have one yet
    if (!(this.tbodyDOMElement instanceof Element)){
        this.tbodyDOMElement = document.createElement('tbody');
        this.formElement.append(this.tbodyDOMElement);
    }

    // remove everything in the tbody (this.rows should still have the ref)
    let tmp = this.tbodyDOMElement.querySelectorAll('tr');
    tmp.forEach(function(row){ this.tbodyDOMElement.removeChild(row); }, this);

    // blow the rows back in
    this.rows.forEach(function(row, idx){
        // if we're inside the chunk window or we're not in chunk mode (maxRows=0), append it
        if (((this.maxRows > 0) && (idx >= this.pageStart) && (idx <= this.pageEnd)) || (this.maxRows == 0)){
            this.tbodyDOMElement.append(row);
        }
    }, this);
    this.updateControlPanel();
}


/*
    these two so you can "fake" the number of rows and pages if you
    don't have them all loaded in at once
*/
// numPages stuff
get numPages(){
    if (this._numPages > 0){
        return(this._numPages);
    }else if (this.maxRows > 0){
        return(Math.ceil(this.numRows/this.maxRows));
    }else{
        return(0);
    }
}
set numPages(v){
    this._numPages = parseInt(v, 10);
}

// numRows stuff
get numRows(){
    if (this._numRows > 0){
        return(this._numRows);
    }else if (this.maxRows > 0){
        return(this.rows.length);
    }
}
set numRows(v){
    this._numRows = parseInt(v, 10);
}

/* control panel visibility */
get showControlPanel(){ return(this._showControlPanel); }
set showControlPanel(v){
    this._showControlPanel = (v === true);
    if (this.hasFormElement){
        this.fetchDOMElements();
        if (this._showControlPanel){
            this.controlPanelDOMElement.style.visibility = 'visible';
        }else{
            this.controlPanelDOMElement.style.visibility = 'hidden';
        }
        this.updateControlPanel();
    }
}

/*
    updateControlPanel()
    this updates the message and toggles the previous and next buttons
*/
updateControlPanel(){
    this.fetchDOMElements();

    let selectedBlurb;
    if ((this.selectMode == 'multiple') || (this.selectMode == 'single')){
        selectedBlurb = `(${this.selectionList.length} selected)`;
    }else if (! isNaN(parseInt(this.selectMode, 10))){
        selectedBlurb = `(${this.selectionList.length}/${this.selectMode} selected)`
    }

    // there is only one page or paging is disabled
    if ((this.pageNumber == 0) || (this.numRows <= this.maxRows) || (this.numPages == 0)){
        this.controlPanelPrevBtn.style.visibility = 'hidden';
        this.controlPanelNextBtn.style.visibility = 'hidden';
        this.message = `${this.numRows} rows ${selectedBlurb}`;

    // paged mode
    }else{
        this.message = `${this.numRows} rows ${selectedBlurb}  page ${this.pageNumber} of ${this.numPages}`;
        this.controlPanelPrevBtn.disabled = (this.pageNumber == 1);
        this.controlPanelNextBtn.disabled = (this.pageNumber == this.numPages);

        if (this.showControlPanel){
            this.controlPanelPrevBtn.style.visibility = 'visible';
            this.controlPanelNextBtn.style.visibility = 'visible';
        }else{
            this.controlPanelPrevBtn.style.visibility = 'hidden';
            this.controlPanelNextBtn.style.visibility = 'hidden';
        }

    }
}

/*
    control panel message stuff
*/
get message(){
    if (this.hasFormElement){
        return(this.controlPanelMessageDOMElement.textContent);
    }else{
        return(this._message);
    }
}
set message(v){
    if (this.controlPanelMessageDOMElement instanceof Element){
        this.controlPanelMessageDOMElement.textContent = v;
    }else{
        this._message = v;
    }
}


/*
    select stuff
*/
get selectionList(){
    this._selectionList = [];
    this.rows.forEach(function(row, idx){
        if (row.dataset.selected === 'true'){ this._selectionList.push(row); }
    }, this);
    return(this._selectionList);
}
get selectMode(){ return(this._selectMode); }
set selectMode(v){
    /*
        this is either one of the following string values:
            'none'      -> selection disabled (so 0)
            'single'    -> single row can be selected (so 1)
            'multiple'  -> unlimited selections
    */
    switch(v){
        case   'none':
            this._selectMode = v;
            break;
        case   'single':
            this._selectMode = v;
            break;
        case   'multiple':
            this._selectMode = v;
            break;
        default:
            if (isNaN(parseInt(v, 10))){
                throw(new noiceException({
                    message:        `${this._className}/selectMode (setter): invlalid value`,
                    messageNumber:   420,
                    thrownBy:       `${this._className}/selectMode (setter)`
                }));
            }else{
                this._selectMode = parseInt(v, 10);
            }
    }
}

/*
    handleRowSelect()
    this is a central event that every row points a click event to
    NOTE: we attached the click event listener to the <tr> (row)
    for some reason, the <td> (cell) is the event target?!
    okay. can deal

*/
handleRowSelect(evt){
    evt.stopPropagation();
    if ((this.selectMode == 'none') || (this.selectMode === 0)){ return(false); }

    let row = evt.target.parentElement;
    if (row.dataset.selected == 'true'){
        // toggling off
        row.dataset.selected = 'false';
        row.dataset.selectOrder = null;
    }else{

        // invoke the rowSelectCallback, if it throws, let it veto the whole thing
        if ((this.hasOwnProperty('rowSelectCallback')) && (this.rowSelectCallback instanceof Function)){
            try {
                this.rowSelectCallback(row, this);
            }catch(e){
                throw(new noiceException({
                    message:        `${this._className}/row select (callback) threw an error: ${e.toString()}`,
                    messageNumber:   421,
                    thrownBy:       `${this._className}/row select (callback)`
                }));
            }
        }

        // selectMode filters
        if (this.selectMode == 'single'){

            // single -- turn everything else off, then turn this one on
            this.selectionList.forEach(function(otherRow){ otherRow.dataset.selected = 'false'; })

        }else if (this.selectMode == 'multiple'){
            // muliple -- yeah whatever -- there's not much to do here I guess

        }else {
            // limit selection to integer limit, deselect from oldest selection
            if ((this.selectionList.length + 1) > this.selectMode){
                this.selectionList.sort(function(a,b){
                    return(a.dataset.selectOrder - b.dataset.selectOrder);
                }).forEach(function(otherRow, idx){
                    if ((this.selectionList.length + 1) > this.selectMode){ otherRow.dataset.selected = 'false'; }
                }, this);
            }
        }

        // execute the selection
        row.dataset.selected = 'true';
        this._selectOrderIndex ++;
        row.dataset.selectOrder = this._selectOrderIndex;
    }
    this.updateControlPanel();
}


/*
    pagination stuff
        * maxRows               (0: unlimited, otherwise this is the page size)
        * pageNumber
        * pageChangeCallback    (invoked when pageNumber changes so you can get data if you need to)
*/
get maxRows(){ return(this._maxRows); }
set maxRows(v){
    if (isNaN(parseInt(v, 10))){
        throw(new noiceException({
            message:        `${this._className}/maxRows (setter) value is not an integer`,
            messageNumber:   420,
            thrownBy:       `${this._className}/maxRows (setter)`
        }));
    }else{
        this._maxRows = parseInt(v, 10);
        if (this._maxRows < 0){ this._maxRows = 0; }
    }

    // update the table on screen if necessary
    if (this.hasFormElement){ this.renderTableContent(); }
}
get pageNumber(){ return(this._pageNumber); }
set pageNumber(v){
    if (isNaN(parseInt(v, 10))){
        throw(new noiceException({
            message:        `${this._className}/pageNumber (setter) value is not an integer`,
            messageNumber:   420,
            thrownBy:       `${this._className}/pageNumber (setter)`
        }));
    }else{

        // execute the async callback if we have one (which might append this.rows), then refresh the table
        if ((this.hasOwnProperty('pageChangeCallback')) && (this.pageChangeCallback instanceof Function)){
            let that = this;
            this.loading = true;
            this.pageChangeCallback(that, v).then(function(result){
                that._pageNumber = parseInt(v, 10);
                if (that._pageNumber < 0){ that._pageNumber = 0; }
                that.renderTableContent();
                that.loading = false;
            }).catch(function(e){
                that.loading = false;
                throw(new noiceException({
                    message:        `${that._className}/pageNumber (setter) pageChangeCallback threw an error: ${e.toString()}`,
                    messageNumber:   420,
                    thrownBy:       `${that._className}/pageNumber (setter) pageChangeCallback`
                }));
            });

        // no callback, just change it and refresh (note, we aren't sanity checking for you)
        }else{
            this._pageNumber = parseInt(v, 10);
            if (this._pageNumber < 0){ this._pageNumber = 1; }
            this.renderTableContent();
        }
    }
}
get pageStart(){
    return(this.pageEnd - (this.maxRows -1));
}
get pageEnd(){
    return((this.maxRows * this.pageNumber)-1);
}
get loading(){ return(this._loading); }
set loading(v){
    /*
        if you want jazzhands on the loading
        state, this is a good one to override
    */
    this._loading = (v === true);
    this.fetchDOMElements();

    this.controlPanelPrevBtn.disabled = this.loading;
    this.controlPanelNextBtn.disabled = this.loading;
}


/*
    getColumnValue(row, column name)
*/
getColumnValue(row, columnName){
    if (this.columnOrder.indexOf(columnName) >= 0){
        // its an on-screen column
        return(row.querySelectorAll('td')[this.columnOrder.indexOf(columnName)].textContent);

    }else if (this.isNotNull(row.dataset[columnName])){
        // check in element.dataset
        return(row.dataset[columnName])

    }else if (this.isNotNull(row.dataset.meta)){
        // check in the meta
        let tmp = JSON.parse(row.dataset.meta);
        if (tmp.hasOwnProperty(columnName)){
            return (tmp[columnName]);
        }
    }

    // if we couldn't find anything by that name
    return(undefined);
}




/*

    sort([{
        columnName: <str>,
        descending: <bool>, (default false)
        numeric:    <bool>  (default false)
    }, ... ])

    this takes an array of objects specifying:
        * columnName    <str>
          see also the columns setter above, this is the
          required unique name attribute of the column
          you wish to sort by

        * descending    <bool> (default false)
          if true, sort greatest to leastest else
          sort leastest to greatestest

        * numeric       <bool> (default false)
          if true, compare by numeric comparison
          else use a string. If you got dates, lets
          just keep it simple and dump epoch to a
          hidden attribute and sort numeric on it

    the order of the objects in the array controls the
    precidence of the sort. Coarse to detail by order
    of the array.

    ok but like, if the object has a sortCallback, then
    we're just gonna call that instead and we're gonna
    ignore whatever was on the argument object

    then we're gonna call renderTableContent()

    can ya dig it?
    yes I can.

*/
sort(sortBy){
    let that = this;

    /*
        LOOSE END:
        we're going to need to do a "fetch all rows" kinda
        thing here if we're in paged mode ...
    */

    if (this.hasOwnProperty('sortCallback') && (this.sortCallback instanceof Function)){
        this.rows.sort(function(a,b){ return(that.sortCallback(a,b, that)); });
    }else{

        // hannle dat biz
        this.rows.sort(function(a,b){
            for (let i=0; i < sortBy.length; i++){
                let rowA = that.getColumnValue(a, sortBy[i].columnName);
                let rowB = that.getColumnValue(b, sortBy[i].columnName);
                if (sortBy[i].descending){
                    // descending
                    switch(sortBy[i].sortMode){
                        case   'numeric':
                            if ((rowB - rowA) !== 0){ return(rowB - rowA); }
                            break;
                        case   'date':
                            let ae = toEpoch(rowA, true);
                            let ab = toEpoch(rowB, true);
                            if (ab - ae !== 0){ return(ab - ae); }
                            break;
                        default:
                            // string
                            if (rowB.localeCompare(rowA) !== 0){ return(rowB.localeCompare(rowA)); }
                    }
                }else{
                    // ascending
                    switch(sortBy[i].sortMode){
                        case   'numeric':
                            if ((rowA - rowB) !== 0){ return(rowA - rowB); }
                            break;
                        case   'date':
                            break;
                            let ae = toEpoch(rowB, true);
                            let ab = toEpoch(rowA, true);
                            if (ab - ae !== 0){ return(ab - ae); }
                        default:
                            // string
                            if (rowA.localeCompare(rowB) !== 0){ return(rowA.localeCompare(rowB)); }
                    }
                }
            }
            return(0);
        });
    }
    this.renderTableContent();
}


/*
    html getter
*/
get html(){
    if (! this.hasAttribute('formElementGUID')){ this.formElementGUID = this.getGUID(); }
    if (! this.hasAttribute('formElementLabelGUID')){ this.formElementLabelGUID = this.getGUID(); }

    return(`
        <label id="${this.formElementLabelGUID}" for="${this.formElementGUID}" class="${this.labelClass}">${this.label}</label>
        <div class="${this.tableContainerClass}">
            <table id="${this.formElementGUID}" class="${this.tableClass}" name="${this.name}" ${(this.enable)?'enabled':'disabled'}></table>
            <div class="${this.controlPanelClass}">
                <span class="${this.messageClass}"></span>
                <button class="${this.lastPageBtnClass}">${this.lastPageBtnLabel}</button>
                <button class="${this.nextPageBtnClass}">${this.nextPageBtnLabel}</button>
            </div>
        </div>
    `);
}

/*
    fetchDOMElements
*/
fetchDOMElements(){
    // get the control panel components
    if (! (this.controlPanelDOMElement instanceof Element)){
        this.controlPanelDOMElement = this.DOMElement.querySelector(`div.${this.controlPanelClass}`);
    }
    if (! (this.controlPanelMessageDOMElement instanceof Element)){
        this.controlPanelMessageDOMElement = this.controlPanelDOMElement.querySelector(`span.${this.messageClass}`);
    }
    if (! (this.controlPanelPrevBtn instanceof Element)){
        this.controlPanelPrevBtn = this.controlPanelDOMElement.querySelector(`button.${this.lastPageBtnClass}`);
    }
    if (! (this.controlPanelNextBtn instanceof Element)){
        this.controlPanelNextBtn = this.controlPanelDOMElement.querySelector(`button.${this.nextPageBtnClass}`);
    }
}

/*
    applyNecessaryStyle()
*/
applyNecessaryStyle(){
    if (! this.hasFormElement){ return(false); }

    // setup the table zIndex
    this.formElement.style.zIndex = 1;

    // setup the control panel
    let myNecessaryStyle = {
        display:             'grid',
        gridTemplateColumns: `3fr 1fr 1fr`,
        overflow:            'hidden',
        alignItems:         'center',
        zIndex:             2
    };
    Object.keys(myNecessaryStyle).forEach(function(k){ this.controlPanelDOMElement.style[k] = myNecessaryStyle[k]; }, this);
    this.controlPanelMessageDOMElement.style.textAlign = 'left';
    this.controlPanelMessageDOMElement.style.overflow = 'hidden';
}


/*
    hangNecessaryHooks()
    setup the control panel
*/
hangNecessaryHooks(){
    if (! this.hasFormElement){ return(false); }
    this.fetchDOMElements();
    let that = this;
    this.controlPanelPrevBtn.addEventListener('click', function(e){
        if (that.pageNumber > 1){ that.pageNumber = (that.pageNumber - 1); }
        e.target.blur();
    });
    this.controlPanelNextBtn.addEventListener('click', function(e){
        if (that.pageNumber < that.numPages){ that.pageNumber = (that.pageNumber + 1); }
        e.target.blur();
    });
}

/*
    sticky header stuff
*/
get stickyHeader(){ return (this._stickyHeader); }
set stickyHeader(v){
    if (this.headerDOMElement instanceof Element){
        if (v === true){
            // set the stickiness on the header
            this.headerDOMElement.style.position = 'sticky';
            this.headerDOMElement.style.top = '0px';

            /*
                pad the last col to make room for the scrollbar
                (note iOS) doesn't really need this.
                nor Chrome
                but i'm like ... super down with firefox so ...
            */
            this.formElement.querySelector('thead tr th:last-child').style.paddingRight = '1.5em';


        }else{
            // unset errythang
            this.headerDOMElement.style.removeProperty('position');
            this.headerDOMElement.style.removeProperty('top');
            this.formElement.querySelector('thead tr th:last-child').style.removeProperty('paddingRight');
        }
    }

    this._stickyHeader = (v === true);
}
get maxHeight(){ return(this._maxHeight); }
set maxHeight(v){
    if (this.isNull(v)){
        this.formElement.style.removeProperty('maxHeight');
    }else{
        // note we're just gonna pass it through anything css-legal is cool
        this._maxHeight = v;
        if (this.hasFormElement){ this.formElement.style.maxHeight = this.maxHeight; }
    }
}


/*
    setup()
*/
setup(){

    this.fetchDOMElements();
    this.applyNecessaryStyle();
    this.hangNecessaryHooks();
    this.renderHeader();

    /*
        if we are in paged mode, set the page to 1
        so we can invoke the callback before we
        render the first time
    */
    if ((this.maxRows > 0) && (this.numPages > 1)){
        this.pageNumber = 1;
    }

    this.stickyHeader = this.stickyHeader;
    this.renderTableContent();
}

/*
    getColumnClickDisposition(col, x)
    determine click disposition: left|center|right|none
    given a column name and an x coordinate
*/
getColumnClickDisposition(colName, x){
    let tmp = this.columnIndex[colName].DOMElement.getBoundingClientRect();

    if ((x >= tmp.left) && (x <= tmp.right)){
        let internalX = (x - tmp.left);
        if (internalX < (tmp.width * this.columnEdgeThreshold)){
            return('left');
        }else if (internalX > (tmp.width - (tmp.width * this.columnEdgeThreshold))){
            return('right');
        }else{
            return('center');
        }
    }else{
        return('none');
    }
}

/*
    hangHeaderColumnHooks(col)
    this is called by renderHeader for each column header
    as it is created. This is just basically down here so
    I can have all the header hooks in one place.
    as this seems to be the stickiest wicket in the place
*/
hangHeaderColumnHooks(col){

    /*
        hang gesture hooks (only works on ios and macos)
    */
    col.gestureHandler = this.getEventListenerWrapper(this.headerGestureHandler);
    col.DOMElement.addEventListener('gesturestart', col.gestureHandler);
}

/*
    hangHeaderRowHooks(tr)
    same thing but for the whole header row
*/
hangHeaderRowHooks(tr){
    if (! this.hasAttribute('headerListeners')){ this.headerListeners = {}; }


    // move hooks
    //['mousemove', 'touchmove'].forEach(function(eventName){
    ['pointermove'].forEach(function(eventName){
        this.headerListeners[eventName] = this.getEventListenerWrapper(this.headerMoveEvent);
    }, this);

    // click hooks (ios is kindly double firing on mousedown, touchstart so just fuckit ... pointerdown seems to work)
    ['pointerdown'].forEach(function(eventName){
        this.headerListeners[eventName] = this.getEventListenerWrapper(this.headerClickDownEvent);
    }, this);

    // exit hooks (again, it looks like the pointer interface is enough on osx)
    // ['mouseup', 'pointerup', 'touchend', 'touchcancel'].forEach(function(eventName){
    ['pointerup'].forEach(function(eventName){
        this.headerListeners[eventName] = this.getEventListenerWrapper(this.headerClickUpEvent);
    }, this);

    // they simply call him .... 'the hanger'
    Object.keys(this.headerListeners).forEach(function(eventName){
        tr.addEventListener(eventName, this.headerListeners[eventName]);
    }, this)
}



/*
    EVENT LISTENERS
    these receive (evt, self)
    where self is a function to the object instance and
    evt is the dispatched event.
*/


/*
    headerMoveEvent(evt, self)
    this is fired on mousemove and touchmove and
    attached to the tr containing the column headers
    however evt.target will contain a reference to the th
*/
headerMoveEvent(evt, self){
    let myX = evt.clientX || evt.touches[0].clientX;
    let col = self.columnIndex[evt.target.dataset.name];

    // on the first drag, block other drags and set this one dragging
    if ((! self.dragging) && (evt.target.dataset.selected == 'true')){
        self.dragging = col.name;
        col.DOMElement.dataset.dragging = 'true';
    }


    // insert shenannigans here
    if (self.dragging){
        /*
            this would be a good place to update the position
            of any avatar you might make for the column header.
        */
    }
}


/*
    headerClickDownEvent(evt, self)
    this is fired on pointerdown and touchstart
    attached to the tr containing the column headers
*/
headerClickDownEvent(evt, self){

    if (! evt.target.dataset.name){ return(false); }
    let col = self.columnIndex[evt.target.dataset.name];
    let myX = evt.clientX || evt.touches[0].clientX;
    let disposition = self.getColumnClickDisposition(evt.target.dataset.name, myX);
    evt.target.dataset.selected = 'true';
}


/*
    headerClickUpEvent(evt, self)
    this is fired on pointerup and touchend
    attached to the tr containing the column headers
*/
headerClickUpEvent(evt, self){
    if (! evt.target.dataset.name){ return(false); }

    let myX = evt.clientX || evt.touches[0].clientX;

    // just reset everything visually
    evt.target.parentElement.querySelectorAll(`th[data-selected='true']`).forEach(function(el){ el.dataset.selected = 'false'; })

    // figure out which column we are over right now
    let tgt = null;
    let edge = 'none';
    self.columnOrder.forEach(function(colName){
        if (self.isNull(tgt)){
            let d = self.getColumnClickDisposition(colName, myX);
            if (d !== 'none'){
                tgt = self.columnIndex[colName].DOMElement;
                edge = d;
            }
        }
    });

    // handle column drag
    if (self.hasAttribute('dragging')){
        if (
            self.isNotNull(tgt) &&
            (self.columnOrder.indexOf(tgt.dataset.name) >=0) &&
            (self.columnOrder.indexOf(tgt.dataset.name) != self.columnOrder.indexOf(self.dragging))
        ){

            // ... i like to ... move it
            self.moveColumn(self.dragging, self.columnOrder.indexOf(tgt.dataset.name), edge);

        }
        self.columnIndex[self.dragging].DOMElement.dataset.dragging = 'false';
        delete(self.dragging);

    // handle edge-drag resizing
    }else if (self.hasAttribute('resizing')){

        // INSERT shenannigans HERE

    // handle sort clicks
    }else{
        switch(evt.target.dataset.sort){
            case 'none':
                evt.target.dataset.sort = 'ascending';
                break;
            case 'ascending':
                evt.target.dataset.sort = 'descending';
                break;
            case 'descending':
                evt.target.dataset.sort = 'none';
                break;
        }
        evt.target.dataset.lastClick = self.epochTimestamp(true);
        self.doColumnSort();
    }
}


/*
    --> Apple Proprietary Gesture Listeners
*/


/*
    headerGestureHandler(evt,self)
    this fires on gestureStart on column headers
    only works on ios and osx
*/
headerGestureHandler(evt, self){
    let col = self.columnIndex[evt.target.dataset.name];
    col.startWidth = evt.target.clientWidth;
    col._headerGestureTmpListeners = {};

    col._headerGestureTmpListeners.gesturechange = self.getEventListenerWrapper(self.headerGestureResize);
    col._headerGestureTmpListeners.gestureend = self.getEventListenerWrapper(self.headerGestureExit);
    Object.keys(col._headerGestureTmpListeners).forEach(function(eventType){
        evt.target.addEventListener(eventType, col._headerGestureTmpListeners[eventType]);
    }, this);

    evt.target.dataset.selected = 'true';
    col.gestureMode = true;
}

/*
    headerGestureResize(evt, self)
    handles column resize via the apple-proprietary zoom gesture
*/
headerGestureResize(evt, self){
    let col = self.columnIndex[evt.target.dataset.name];
    let newWidth = (col.startWidth * evt.scale);
    let delta = (col.startWidth - newWidth);
    let colIdx = self.columnOrder.indexOf(evt.target.dataset.name);

    // determine neighbors to split the delta with
    let siblings = [];
    if (colIdx == 0){
        // first subtracts from the neighbor to the right
        siblings.push(self.columnIndex[self.columnOrder[1]]);
    }else if (colIdx == (self.columnOrder.length -1)){
        // last subtracts from the neighbor to the left
        siblings.push(self.columnIndex[self.columnOrder[colIdx -1]]);
    }else{
        // half it between the neighbors
        siblings.push(self.columnIndex[self.columnOrder[colIdx -1]]);
        siblings.push(self.columnIndex[self.columnOrder[colIdx +1]]);
    }

    // paint 'em next refresh
    window.requestAnimationFrame(function(){
        siblings.forEach(function(sib){
            sib.DOMElement.style.width = `${(sib.DOMElement.clientWidth - (delta/siblings.length))}px`;
        });
        evt.target.style.width = `${newWidth}px`;
    });
}

/*
    headerGestureExit(evt,self)
    handles exiting a column header gesture
*/
headerGestureExit(evt,self){
    let col = self.columnIndex[evt.target.dataset.name];
    Object.keys(col._headerGestureTmpListeners).forEach(function(eventType){
        evt.target.removeEventListener(eventType, col._headerGestureTmpListeners[eventType]);
    }, this);
    col._headerGestureTmpListeners = {};
    evt.target.dataset.selected = 'false';
    col.gestureMode = false;
}







}  // noiceCoreUIFormElementTable
