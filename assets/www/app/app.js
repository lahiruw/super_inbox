//Database setting up
var sinbox = {};
    sinbox.webdb = {};
    sinbox.webdb.db = null;
var dbSize = 10*1024*1024; //10 MB
var dbName = 'sinbox';
var dbVersion = '1.0';
var dbDescription = 'sinbox data base';

//string messages 
var errorTitle = 'Error';
var successTitle = 'Success';
var lastSavedPlaneName = '';
var lastSavedPlaneDid = -1 ;

var planeDid =-1;
var selectedPlaneRecord = null;
var activePlane = null;
var activatedPlaneName = 'Name';
var selectedMessage = null;



var TABLE_PLANE=" CREATE TABLE Plane (" +
			"	 id INTEGER PRIMARY KEY AUTOINCREMENT,"+  
				"name TEXT NOT NULL,"+  
				"iconPath TEXT ,"+
				"color TEXT ,"+
				"active INTEGER NOT NULL,"+
				"state TEXT NOT NULL,"+
				"priority TEXT NOT NULL,"+
				"description TEXT NOT NULL"+
				");   " ;
				
var TABLE_CATEGORY="CREATE TABLE Category ("+
				"id INTEGER PRIMARY KEY AUTOINCREMENT,"+ 
				"name TEXT NOT NULL,"+ 
				"icon TEXT,"+
				"color TEXT,"+
				"priority TEXT NOT NULL,"+
				"active TEXT NOT NULL,"+
				"description TEXT,"+
				"messageCount INTEGER default 0 ,"+
				"probability FLOAT,"+
				"planeId INTEGER REFERENCES Plane(id)"+
				");";
				
var TABLE_PLANE_CATEGORY="CREATE TABLE Plane_Category ("+
			"did INTEGER PRIMARY KEY  AUTOINCREMENT,"+ 
			"categoryId INTEGER REFERENCES Category(id),"+
			"planeId INTEGER REFERENCES Plane(id),"+			
			"wordCount INTEGER "+
			");";	

var TABLE_WORD_CATEGORY = "CREATE TABLE Word_Category ("+
			"wordHash TEXT NOT NULL,"+ 
			"categoryId INTEGER REFERENCES Category(id),"+
			"planeId INTEGER REFERENCES Plane(id),"+			
			"wordCount INTEGER default 0 , "+
			"P1 FLOAT default 0.00001,  "+  // p(y/x) 
			"P2 FLOAT default 0.00001,  "+ // p(y)
			"totalCountForHash  number DEFAULT 0, "+
			"changeDate  text,"+
			"totalCount NUMBER default 0, "+
			"totalCountInCategory NUMBER default 0 ,"+
			"PRIMARY KEY (wordHash, categoryId, planeId)  ON CONFLICT IGNORE "+
			");";

var TABLE_TEMP_INT="CREATE TABLE TMP_INT ( "+
		    " V1 INTEGER, V2 INTEGER ); " ;			
			
var TABLE_TEMP_INT_2_FLOAT = " CREATE TABLE TMP_INT_2_FLOAT ( "+
			" V1  integer DEFAULT 0, "+
			" V2  integer DEFAULT 0, "+
			" V3  float DEFAULT 0.0 "+
			" ); ";
				
var TABLE_SMS_STATE = " CREATE TABLE SMS_STATE ("+
			" messageDID INTEGER NOT NULL ,"+
			" planeDID INTEGER NOT NULL ,"+
			" isTrained INTEGER DEFAULT 0 ,"+
			" categoryDID DEFAULT 0, "+
			" PRIMARY KEY (messageDID, planeDID)  ON CONFLICT IGNORE "+
			" ); ";		


function intializeDataBase(){
	sinbox.webdb.db = openDatabase(dbName, dbVersion , dbDescription , dbSize);
	setUpInitialTables();
}

function setUpInitialTables(){
    sinbox.webdb.db.transaction(function(tx) {
	
          tx.executeSql( TABLE_PLANE , []);
          tx.executeSql( TABLE_CATEGORY , []);
          tx.executeSql( TABLE_PLANE_CATEGORY , []);
          tx.executeSql( TABLE_WORD_CATEGORY , []);
          tx.executeSql( TABLE_TEMP_INT , []);
          tx.executeSql( TABLE_TEMP_INT_2_FLOAT , []);
          tx.executeSql( TABLE_SMS_STATE , []);
		  
        });
}


/*
Saving new plane
*/

sinbox.webdb.addPlane = function(plane) {
        var db = sinbox.webdb.db;
        db.transaction(function(tx){
          var addedOn = new Date();
		  lastSavedPlaneName = plane.get('name');
          tx.executeSql(	  
			  "INSERT INTO Plane ( name,active,state,priority,description)values(?,?,?,?,?)",
              [plane.get('name'),plane.get('active'),plane.get('state'),plane.get('priority'),plane.get('description')],
              sinbox.webdb.addPlane.onSuccess,
              sinbox.webdb.addPlane.onError
			  );
         });
      }
	  
sinbox.webdb.addPlane.onSuccess = function(tx, rs) {
	//clean the form
	Ext.Msg.alert(successTitle, 'Successfully Saved', Ext.emptyFn);
	//enable add category button
			var addCategoryButton =  Ext.getCmp('addCategoryId');
		    addCategoryButton.enable();
      }
	  
//saving category and save to plane category if success
sinbox.webdb.addCategory = function(category){
	var db = sinbox.webdb.db;
		db.transaction(function(tx){
			var insertStatement = "INSERT INTO Category (name,icon,color,priority,active,description,planeId) VALUES (?,?,?,?,?,?,?) ";
			tx.executeSql(insertStatement,
			[category.get('name'),category.get('icon'),category.get('color'),category.get('priority'),category.get('active'),category.get('description'),category.get('planeId')],
			function(tx,rs){
				//inserting plane category
				var insertStatementPlaneCategory = 'INSERT INTO Plane_Category (categoryId,planeId,wordCount) VALUES (?,?,?) ';
				tx.executeSql(insertStatementPlaneCategory,
			    [rs.insertId,lastSavedPlaneDid,0],
				function(tx,rs){
					Ext.Msg.alert(successTitle, 'Successfully Saved');
				},
				sinbox.webdb.addCategory.onError);
			},
			sinbox.webdb.addCategory.onError);
		});
}

sinbox.webdb.changeStateToTrainedIfPossible = function(state,successFunction){
	var db = sinbox.webdb.db;
		db.transaction(function(tx){
			var query = "SELECT * FROM Plane WHERE state IN ('TRAINING','APPLIED') AND active = 1 ";
			tx.executeSql(query,
			[selectedPlaneRecord.get('id')],
			successFunction,
			function (tx,e){Ext.Msg.alert(errorTitle, 'Error while updating plane mood to TRAINING '+e.message());}
			);
		});
}

function updatePlaneStateToTesting(){
						 var updateQuery  = "UPDATE Plane SET state ='TESTING',active = 1  WHERE id =?";
						 	var db = sinbox.webdb.db;
							db.transaction(function(tx){
								tx.executeSql(updateQuery,
									[selectedPlaneRecord.get('id')],
									function(tx,rs){
										Ext.Msg.alert(successTitle, 'Successfully changed operation mood to TESTING');
										Ext.getCmp('planeStatus_config').setValue('TESTING');
										Ext.getCmp('applyMode_id').setValue(1);
										Ext.getCmp('trainingMode_id').setValue(0);
										Ext.getCmp('appliedMode_id').setValue(0);
										
									},
									function(tx,e){
										Ext.Msg.alert(errorTitle, 'Error while updating plane mood to TESTING '+e.message());
									});
								});
}

function updatePlaneStateToApplied(){
	 var updateQuery  = "UPDATE Plane SET state ='APPLIED',active = 1  WHERE id =?";
	 	var db = sinbox.webdb.db;
		db.transaction(function(tx){
			tx.executeSql(updateQuery,
				[selectedPlaneRecord.get('id')],
				function(tx,rs){
					Ext.Msg.alert(successTitle, 'Successfully changed operation mood to APPLIED');
					Ext.getCmp('planeStatus_config').setValue('APPLIED');
					Ext.getCmp('applyMode_id').setValue(0);
					Ext.getCmp('trainingMode_id').setValue(0);
					Ext.getCmp('appliedMode_id').setValue(1);
					
				},
				function(tx,e){
					Ext.Msg.alert(errorTitle, 'Error while updating plane mood to APPLIED '+e.message());
				});
			});
}


function  setToTestingMood(){

	var db = sinbox.webdb.db;
		db.transaction(function(tx){
			var query = "SELECT * FROM Plane WHERE state IN ('TRAINING','APPLIED','TESTING') AND active = 1 ";
			tx.executeSql(query,
			[],
			function(tx,rs){
			var resultCount = rs.rows.length;
			if(resultCount > 0){
             Ext.Msg.confirm(
					 "Confirmation",
					 " Do you need to change operation mood to TESTING ? ",
					 function (btn) {
						 if (btn === 'yes') {
								updatePlaneStateToTesting();
								////Update other planes to TRAINED moode wich are in applied or training moode
						 }
						 else {
							Ext.getCmp('applyMode_id').setValue(0);
						 }
					 },
					 this
			   );			 
			}else{
			//update to applied
				updatePlaneStateToTesting();
			}
			},
			sinbox.webdb.onError);
		});
}

function  setToApplyMood(){

	var db = sinbox.webdb.db;
		db.transaction(function(tx){
			var query = "SELECT * FROM Plane WHERE state IN ('TRAINING','APPLIED','TESTING') AND active = 1 ";
			tx.executeSql(query,
			[],
			function(tx,rs){
			var resultCount = rs.rows.length;
			if(resultCount > 0){
             Ext.Msg.confirm(
					 "Confirmation",
					 " Do you need to change operation mood to APPLIED ? ",
					 function (btn) {
						 if (btn === 'yes') {
								updatePlaneStateToApplied();
								////Update other planes to TRAINED moode wich are in applied or training moode
						 }
						 else {
							Ext.getCmp('appliedMode_id').setValue(0);
						 }
					 },
					 this
			   );			 
			}else{
			//update to applied
				updatePlaneStateToApplied();
			}
			},
			sinbox.webdb.onError);
		});
}

function setToTrained_Success_Train(){
		Ext.Msg.alert(successTitle, 'Successfully changed plane mood to TRAINED');
		Ext.getCmp('planeStatus_config').setValue('TRAINED');
}

function setToTrained_Error_Train(tx,e){
Ext.Msg.alert(errorTitle, 'Error while updating operation mood to TRAINED '+e.message());
}

function setToTrained_Success_Apply(){
		Ext.Msg.alert(successTitle, 'Successfully changed plane mood to TRAINED');
		Ext.getCmp('planeStatus_config').setValue('TRAINED');
}

function setToTrained_Error_Apply(tx,e){
Ext.Msg.alert(errorTitle, 'Error while updating plane mood to TRAINED '+e.message());
}

function  setToTrained(successFunction,errorFunction){
             Ext.Msg.confirm(
					 "Confirmation",
					 "Are you sure you want to set this plane to trained mood?",
					 function (btn) {
						 if (btn === 'yes') {
						 var updateQuery  = "UPDATE Plane SET state ='TRAINED',active = 1  WHERE id =?";
						 	var db = sinbox.webdb.db;
							db.transaction(function(tx){
								tx.executeSql(updateQuery,
									[selectedPlaneRecord.get('id')],
									successFunction,
									errorFunction);
								});
						 }
						 else {
							Ext.getCmp('trainingMode_id').setValue(0);
						 }
					 },
					 this
			   );
}

function  setToTraining(){

             Ext.Msg.confirm(
					 "Confirmation",
					 "Do you need to change operation mood to TRAINING ? ",
					 function (btn) {
						 if (btn === 'yes') {
						 var updateQuery  = "UPDATE Plane SET state ='TRAINING',active = 1  WHERE id =?";
						 	var db = sinbox.webdb.db;
							db.transaction(function(tx){
								tx.executeSql(updateQuery,
									[selectedPlaneRecord.get('id')],
									function(tx,rs){
										Ext.Msg.alert(successTitle, 'Successfully changed operation mood to TRAINING');
										Ext.getCmp('planeStatus_config').setValue('TRAINING');
										Ext.getCmp('applyMode_id').setValue(0);
										Ext.getCmp('trainingMode_id').setValue(1);
										Ext.getCmp('appliedMode_id').setValue(0);
										
										//update rest to trained state
										var updateToTrained =  "UPDATE Plane SET state = 'TRAINED' WHERE state IN ('APPLIED','TRAINING','TESTING') AND id !=? ";
										var db1 = sinbox.webdb.db;
										db1.transaction(function (tx){
										tx.executeSql(
										updateToTrained,[selectedPlaneRecord.get('id')],function(tx,rs){},
										function(tx,e){}
										);
										});
										
									},
									function(tx,e){
										Ext.Msg.alert(errorTitle, 'Error while updating plane mood to TRAINING '+e.message);
									});
								});
						 }
						 else {
							Ext.getCmp('trainingMode_id').setValue(0);
						 }
					 },
					 this
			   );
				//}
}
	  
sinbox.webdb.addCategory.onError = function(tx,e){
		Ext.Msg.alert(errorTitle, 'Error while saving new category : '+e.message, Ext.emptyFn);
}	  

sinbox.webdb.addPlane.onError = function(tx, e) {
		lastSavedPlaneName = '';
		lastSavedPlaneDid = -1;
		Ext.Msg.alert(errorTitle, 'Error while saving new plane : '+e.message, Ext.emptyFn);
      }	 

sinbox.webdb.onError = function (tx, e){
		Ext.Msg.alert(errorTitle, 'Error while executing data base command', Ext.emptyFn);
}	  

// data stores and models 

Ext.define('Plane', {
    extend: 'Ext.data.Model',

    config: {
        fields: [
            {name: 'id',  type: 'number'},
			{name: 'name',  type: 'string'}, // not null
            {name: 'iconPath',  type: 'string'},
            {name: 'color',  type: 'string'},
            {name: 'active',  type: 'number'}, // not null
            {name: 'state',  type: 'string'},// not null
            {name: 'priority',  type: 'string'},// not null
            {name: 'description',  type: 'string'}// not null
        ]
    }
});

Ext.define('Message', {
    extend: 'Ext.data.Model',

    config: {
        fields: [
            {name: 'id',  type: 'number'},
			{name: 'sender',  type: 'string'}, 
            {name: 'text',  type: 'string'},
			{name: 'categoryDid', type: 'number'},
			{name: 'planeDid', type: 'number'},
			{name: 'isTrained', type:'number'}
        ]
    }
});

	Ext.define('Category', {
		extend: 'Ext.data.Model',
		config: {
			fields:[
				{name: 'id',  type: 'number'},
				{name: 'name',  type: 'string'}, // not null
				{name: 'icon',  type: 'string'},
				{name: 'color',  type: 'string'},
				{name: 'active',  type: 'number'}, // not null
				{name: 'priority',  type: 'string'},// not null
				{name: 'description',  type: 'string'},
				{name: 'messageCount', type: 'number'},
				{name: 'probability',type:'float'},
				{name: 'planeId',type:'number'}
				]
		}
	});

	var currentMessagesStore = Ext.create('Ext.data.Store', {
	   model: 'Message',
	   sorters: 'id',

	   grouper: {
		   groupFn: function(record) {
			   return record.get('id')[0];
		   }
	   },
//dummy data
	   data: [
		   { id: 1,   sender: 'Maintz' , text:'how are you amith' },
		   { id: 2,    sender: 'Dougan' , text: 'how to train dragon'},
		//   { id: 3,   sender: 'Spencer' , text:'proove you are ok'},
		   { id: 3,   sender: 'Avins'  ,  text:'amith is bad'},
		   { id: 4,   sender: 'Conran' ,  text:'wwe is bad'}
	   ]
	});
	

	
		var classifiedMessagesStore = Ext.create('Ext.data.Store', {
	   model: 'Message',
	   sorters: 'id',

	   grouper: {
		   groupFn: function(record) {
			   return record.get('id')[0];
		   }
	   },
//dummy data
	   data: [
		   { id: 1,   sender: 'Maintz' , text:'how are you amith' },
		   { id: 2,    sender: 'Dougan' , text: 'how to train dragon'},
		//   { id: 3,   sender: 'Spencer' , text:'proove you are ok'},
		   { id: 3,   sender: 'Avins'  ,  text:'amith is bad'},
		   { id: 4,   sender: 'Conran' ,  text:'wwe is bad'}
	   ]
	});
	
	var existingPlaneStore = Ext.create('Ext.data.Store', {
	   model: 'Plane',
	   sorters: 'id',

	   grouper: {
		   groupFn: function(record) {
			   return record.get('id')[0];
		   }
	   },
//dummy data
	   data: [
		   { id: 1,   name: 'Maintz'  },
		   { id: 2,    name: 'Dougan'  },
		   { id: 3,   name: 'Spencer' },
		   { id: 4,   name: 'Avins'   },
		   { id: 5,   name: 'Conran'  }
	   ]
	});
	
							var categoryStoreForTraining = Ext.create('Ext.data.ArrayStore', {
								autoDestroy: true,
								storeId: 'myStore',
								idIndex: 0,
								fields: [
								   {name: 'text'},
								   {name: 'value', type: 'number'}
								]
							});	

// end of data srore definitions
	 
function dashBoardPlaneRender(tx, rs){
	existingPlaneStore.removeAll();
        for (var i=0; i < rs.rows.length; i++) {
           // alert(rs.rows.item(12).id);
			var plane = Ext.create('Plane', {
				name: rs.rows.item(i).name,
				active: rs.rows.item(i).active,
				state: rs.rows.item(i).state,
				priority: rs.rows.item(i).priority,
				description: rs.rows.item(i).description,
				id : rs.rows.item(i).id,
				iconPath : rs.rows.item(i).iconPath,
				color : rs.rows.item(i).color
			});
		existingPlaneStore.add(plane);	
        }
}

function planeConfigurationStoreRenderer(tx, rs ){
	existingPlaneStore.removeAll();
        for (var i=0; i < rs.rows.length; i++) {
			var plane = Ext.create('Plane', {
				name: rs.rows.item(i).name,
				active: rs.rows.item(i).active,
				state: rs.rows.item(i).state,
				priority: rs.rows.item(i).priority,
				description: rs.rows.item(i).description,
				id : rs.rows.item(i).id,
				iconPath : rs.rows.item(i).iconPath,
				color : rs.rows.item(i).color
			});
		existingPlaneStore.add(plane);	
        }
}
 
sinbox.webdb.getAllPlane = function(renderFunction){
	var db = sinbox.webdb.db;
        db.transaction(function(tx) {
          tx.executeSql("SELECT * FROM Plane WHERE state !=? ", ['DISABLED'], renderFunction,
              sinbox.webdb.onError);
        });
}

sinbox.webdb.getPlaneByName = function(planeName,successFunction,errorFunction){
	var db= sinbox.webdb.db;
	db.transaction(function(tx){
		tx.executeSql("SELECT * FROM Plane WHERE name=?",[planeName],successFunction,errorFunction);
	});
}


	//reading SMS 
	
populateTabsWithCategories =  function(){
	//Cleaning existing tabs 
	
	Ext.getCmp('tab1TabPanel').removeAll(true);
	
	var db = sinbox.webdb.db;
	var categoryArray = new Array();
	db.transaction(function(tx){
		var sql = "SELECT * FROM Category WHERE planeId =?";
		tx.executeSql(sql,[activePlane.get('id')],function(tx,rs){

			var tabPanel = Ext.getCmp('tab1TabPanel');
			
			for(var j=0;j< rs.rows.length;j++){
				var currentItem_1 = rs.rows.item(j);
				categoryArray.push(currentItem_1.id);
			}

			for(var i=0;i< rs.rows.length;i++){
				var currentItem = rs.rows.item(i);
				var key = ''+activePlane.get('id')+'_'+currentItem.name;

				saveString(key,new String(currentItem.id));
				
				tabPanel.add(
				{
					title: currentItem.name,
					xtype: 'list',
					store: currentMessagesStore,
					mode : 'MULTI',
					displayValue : 'id' ,
					id:key,
//					itemTpl: '<div class="contact">{sender} : <strong>{text}</strong></div>',

					itemTpl : new Ext.XTemplate(
			                '{% var bStyle =  values.isTrained > 0 ? "background-color: #ababab" : "background-color: #00BFFF"; %}',
			                '<div style="{[bStyle]}">{sender} : <strong>{text}</strong></div>'
			            ),					
					listeners: {

                        select:function(list, model){
                            if(model.get('isTrained') == 1){
                                list.deselect(model);
                                return false;
                            }
                        },
						itemtaphold : function(btn){
							var activePlaneState = activePlane.get('state');
							if(activePlaneState == 'TESTING'){
								loadPicker(this.id);
							}else{
						        Ext.Msg.show({
							            title: 'Reply to sender.',
							            msg: 'Say your idea :',
							            width:300,
							            multiLine : 100,
							            buttons: [Ext.MessageBox.CANCEL ,  {
		                                    text : 'Send', itemId : "send", ui : "action"
		                                }],
							            multiline: true,
							            fn : function(btn,text){
							            	//alert('heeee '+ text);
							            	//alert('button : '+btn);
							            	// TODO move to a private function and re use .
											var messageText = text;
											var planeDid = activePlane.get('id') ;
											var categoryDid = getString(this.id);
											if (messageText != null
													&& messageText.length > 0 && categoryDid != null && categoryDid > 0) {
												tokenArray = messageText.split(" ");
											}
											if (tokenArray != null && tokenArray.length > 0) {
												// update word category LS
												for ( var i = 0; i < tokenArray.length; i++) {
													var wordKey = getUniqueKeyForWord(planeDid,categoryDid,tokenArray[i]);
													updateOrSaveWordCount(wordKey, 1);
												}
												var categoryKey = getUniqueKeyForCategory(planeDid,categoryDid);
												// update message count of
												// category
												updateOrSaveCategoryMessageCount(categoryKey, 1);
												// change when multi select  available
												// update category LS

												updateOrSaveCategoryWordCount(categoryKey,tokenArray.length);

												// update plane LS
												updateOrSavePlaneMessageCount(planeDid, 1);
												// change when multi select available
											}
							            	//TODO implement actual sending process for SMS 
							            },
							            animateTarget: 'mb3'
							        });
							}
							
						},
						show : function() {	
						//----------------	
						//	Ext.Viewport.setMasked({xtype:'loadmask',message:'loading..'});
							var categoryDidKey = tabPanel.getActiveItem( ).getId();
							var loadAllMessages = 'YES';
						    var numberOfMessage =  getString('MESSAGES_COUNT');
						    
							if(numberOfMessage  == null || numberOfMessage  < 1){
								numberOfMessage  = 100;
							}
							cordova.exec(function(winParam) {
								
								currentMessagesStore.removeAll();	

								if(winParam.texts.length > 0){

										for (var i = 0; i < winParam.texts.length; i++) {
		
											var messageKey = ''+activePlane.get('id')+'_'+winParam.texts[i]._id;

												var trainedMessage = getObject(messageKey);

												var isTrained = 0;
												if(trainedMessage != null  && parseInt(trainedMessage.messageDID) > 0 ){
													isTrained = 1;
												}
											
											var message = Ext.create('Message', {
												id: winParam.texts[i]._id,
												sender: winParam.texts[i].address,
												text: winParam.texts[i].message,
												isTrained:isTrained
											});
											
											//check for existing trained message
											var messageKey = ''+activePlane.get('id')+'_'+winParam.texts[i]._id;
											var trainedMessage = getObject(messageKey);
											var  categoryDid = -1;
											if(trainedMessage == null  || parseInt(trainedMessage.messageDID) < 0 ){
											//that means we have to train and save the result
												categoryDid = getCategory(activePlane.get('id'),categoryArray,message.get('id'),message.get('text'));
											}else{
												categoryDid = trainedMessage.categoryDID;
											}

											if(parseInt(getString(categoryDidKey),10) ==  categoryDid ){
												currentMessagesStore.add(message);
											}
											
										}
									//	Ext.Viewport.setMasked(false);
									
							}
								//Ext.Viewport.setMasked(false);
							}
							, function(error) {
								alert("An error has occurred");
								console.log("An error has occurred");
								console.log( JSON.stringify(error) );
							}
							, "ReadSms"
							,"GetTexts"
							, [loadAllMessages, parseInt(numberOfMessage)]);
						
						}
					}
				}
				);
			}
			
		},function(tx,e){
			alert(e.message);
		});
	});
}	
	
						
	 loadAllSMS = function(totalMessages) {
		 
    document.addEventListener("deviceready", function () {
    var loadAllMessages = 'YES';
    cordova.exec(function(winParam) {

		currentMessagesStore.removeAll();	
        for (var i = 0; i < winParam.texts.length; i++) {
        	
			//check for existing trained message
			var messageKey = ''+activePlane.get('id')+'_'+winParam.texts[i]._id;
			var trainedMessage = getObject(messageKey);
			var isTrained = 0;
			if(trainedMessage != null  && parseInt(trainedMessage.messageDID) > 0 ){
				isTrained = 1;
			}
			var message = Ext.create('Message', {
				id: winParam.texts[i]._id,
				sender: winParam.texts[i].address,
				text: winParam.texts[i].message,
				isTrained:isTrained
			});
			currentMessagesStore.add(message);
        }
    }
    , function(error) {
        alert("An error has occurred");
        console.log("An error has occurred");
        // Please refer to previous comment about json2 library.
        console.log( JSON.stringify(error) );
    }
    , "ReadSms"
    ,"GetTexts"
    , [loadAllMessages, totalMessages]);
     	
    }, false);
	 }

var slots = null;

function loadPicker(listId) {

	var selection = Ext.getCmp(listId).getSelection();

	if (selection != null && selection.length > 0) {

		var picker = Ext.create('Ext.Picker',
						{
							useTitles : true,
							listeners : {
								change : {
									fn : function() {
										var items = this.getItems().items, ln = items.length, item, i, players = {};
										var categoryDid = null;
										var tokenArray = null;
										var planeDid = activePlane.get('id');
										var categoryName = '';

										for (i = 0; i < ln; i++) {
											item = items[i];
											if (item && item.isSlot) {
												categoryDid = item.getStore().getAt(item.selectedIndex).get(item.getValueField());
												categoryName = item.getStore().getAt(item.selectedIndex)._data.text;
											}
										}
										if (categoryDid != null) {
										    Ext.Msg.confirm(
													 "Confirmation",
													 "Training selected messages on to "+categoryName+" category ",
													 function (btn) {
														 if (btn === 'yes') {
															 
																Ext.Viewport.setMasked({xtype:'loadmask',message:'Training....'});
																for ( var k = 0; k < selection.length; k++) {
																	selectedMessage = selection[k];
																	// change message state to trained
																	var messageKey = getUniqueKeyMessage(planeDid,selectedMessage.get('id'));
																	updateOrSaveMessageState(messageKey, 1,categoryDid);
																	// add message vs class to LS
																	// Updating LOcal storages
																	// Get word array
																	var messageText = selectedMessage.get('text');
																	if (messageText != null
																			&& messageText.length > 0) {
																		tokenArray = messageText.split(" ");
																	}
																	if (tokenArray != null && tokenArray.length > 0) {
																		// update word category LS
																		for ( var i = 0; i < tokenArray.length; i++) {
																			var wordKey = getUniqueKeyForWord(planeDid,categoryDid,tokenArray[i]);
																			updateOrSaveWordCount(wordKey, 1);
																		}
																		var categoryKey = getUniqueKeyForCategory(planeDid,categoryDid);
																		// update message count of
																		// category
																		updateOrSaveCategoryMessageCount(categoryKey, 1);
																		// change when multi select  available
																		// update category LS

																		updateOrSaveCategoryWordCount(categoryKey,tokenArray.length);

																		// update plane LS
																		updateOrSavePlaneMessageCount(planeDid, 1);
																		// change when multi select available
																	}
																	//currentMessagesStore.remove(selectedMessage);
																	//remove from the list if trained category is differ from current tab.
																	if(listId == 'trainingMoodList'){
																		var recordIndex = currentMessagesStore.findExact('id',selectedMessage.get('id'));
																		var record =  currentMessagesStore.getAt(recordIndex);
																		//console.log('record : '+record);
																		if(record != null){
																		record.set('isTrained', 1);
																		}	
																	}else{
																		if(categoryDid == parseInt(getString(listId))){
																			//change color and mark as trained
																			// 
																			var recordIndex = currentMessagesStore.findExact('id',selectedMessage.get('id'));
																			var record =  currentMessagesStore.getAt(recordIndex);
																			//console.log('record : '+record);
																			if(record != null){
																			record.set('isTrained', 1);
																			}
																		}else{
																			//remove from list store.
																			currentMessagesStore.remove(selectedMessage);
																			
																		}	
																	}
																	}
																Ext.getCmp(listId).deselectAll();
																//else change the record to trained and change the color
																Ext.Viewport.setMasked(false);	

														 }
														 else {
															//do nothing
														 }
													 },
													 this
											 );
										}
										
									}
								}
							}
						});
		picker.setSlots(slots);
		picker.show();
	} else {
		Ext.Msg.alert(errorTitle,
				'Please select atlease one message for training', Ext.emptyFn);
	}
}	
		
function disablePlane(planeId){
	
	//alert('plane id  : '+planeId);
    Ext.Msg.confirm(
			 "Confirmation",
			 "Are you really wants to remove plane ?",
			 function (btn) {
				 if (btn === 'yes') {
					 var updateQuery  = "UPDATE Plane SET state =?  WHERE id =?";
					 	var db = sinbox.webdb.db;
						db.transaction(function(tx){
							tx.executeSql(updateQuery,
								['DISABLED',planeId],
								function(tx,rs){
									Ext.Msg.alert(successTitle, 'Plane successfully removed ');		
									sinbox.webdb.getAllPlane(dashBoardPlaneRender);
								},
								function(tx,e){
									Ext.Msg.alert(errorTitle, 'Error while removing plane  '+e.message());
								});
							});
				 }
				 else {
					//do nothing
				 }
			 },
			 this
	   );

}

function intialzeInboxTab() {
console.log('called intialize tab');
    
	console.log('loading....');
Ext.getCmp('tab1TabPanel').removeAll(true);
	var db = sinbox.webdb.db;
	db.transaction(function(tx) {
				tx.executeSql("SELECT * FROM Plane WHERE state IN ('TRAINING','APPLIED','TESTING')",
								[],
								function(tx, rs) {
									var resultCount = rs.rows.length;
									var tabPanel = Ext.getCmp('tab1TabPanel');
									console.log('resultCount '+ resultCount);
									if (resultCount == 1) {
										console.log('active plane name  : '+ rs.rows.item(0).name);
										var planeObj = Ext.create('Plane',
														{
															name : rs.rows.item(0).name,
															active : rs.rows.item(0).active,
															state : rs.rows.item(0).state,
															priority : rs.rows.item(0).priority,
															description : rs.rows.item(0).description,
															id : rs.rows.item(0).id,
															iconPath : rs.rows.item(0).iconPath,
															color : rs.rows.item(0).color
														});

										//if (activePlane == null || activePlane.get('id') != planeObj.get('id')) {
											activePlane = planeObj;
											// Load categories for this plane
											// object

											var db = sinbox.webdb.db;
											db.transaction(function(tx) {
														var sql = "SELECT * FROM Category WHERE planeId =?";
														tx.executeSql(sql,[ activePlane.get('id') ],
																		function(tx,rs) {
															console.log('total categories ');
																			for ( var i = 0; i < rs.rows.length; i++) {
																				var currentItem = rs.rows.item(i);
																				categoryStoreForTraining.add({
																							text : currentItem.name,
																							value : currentItem.id
																						});
																			}

																		},
																		function(tx,e) {
																			alert(e.message);
																		});
													});

											slots = Ext
											.create(
													'Ext.picker.Slot',
													{
														name : 'monthsx',
														title : 'Select Category',
														store : categoryStoreForTraining
													});
											// -----------------------
											if (rs.rows.item(0).state == 'TRAINING') {
												// one tab
												// List view for training mood


												tabPanel.add({
															title : '<div class="contact"> <button title="click after select messages" type="button"><img src="./img/resources/icons/train.jpg" width="40" height="20" onclick="loadPicker(\'trainingMoodList\')"></img></button>Training Mood</div>',
															xtype : 'list',
															mode : 'MULTI',
															id : 'trainingMoodList',
															store : currentMessagesStore,
															displayValue : 'id',
															itemTpl : new Ext.XTemplate(
													                '{% var bStyle =  values.isTrained > 0 ? "background-color: #ababab" : "background-color: transparent"; %}',
													                '<div style="{[bStyle]}">{sender} : <strong>{text}</strong></div>'
													            ),
											                listeners:{
											                        select:function(list, model){
											                            if(model.get('isTrained') == 1){
											                                list.deselect(model);
											                                return false;
											                            }
											                        }
											                   }													            	
														});
												var numberOfMessage =  getString('MESSAGES_COUNT');
												//alert('Training numberOfMessage '+ numberOfMessage);
												if(numberOfMessage  == null || numberOfMessage  < 1){
													numberOfMessage  = 100;
												}
												loadAllSMS(parseInt(numberOfMessage));

											} else {
												populateTabsWithCategories();
											}
										//}
									} else {
										tabPanel.add({
													html : 'No active plane in either TRAINING or APPLIED or TESTING state'
												});
									}
								}, sinbox.webdb.onError);
			});
}

 function getLastSavedPlaneByName_Success(tx,rs){
		var planeDid = -1 ;
		if(rs.rows.length > 0){
			planeDid = rs.rows.item(0).id;
		}
		lastSavedPlaneDid = planeDid;
}

 function isPlaneExist_Success(tx,rs){

			var resultCount = rs.rows.length;
			if(resultCount > 0 ){
				// can not have same id with two planes
				Ext.Msg.alert(errorTitle, 'Plane Name allready exist', Ext.emptyFn);
				Ext.getCmp("planeId").reset();
			}
}	

sinbox.webdb.onError = function (tx, e){
		Ext.Msg.alert(errorTitle, e.message, Ext.emptyFn);
}	  

Ext.application({

    name: 'Sinbox',
    //here we require any components we are using in our application
    requires: ['Ext.*'],
    /*
    icon: {
        '57': 'resources/icons/Icon.png',
        '72': 'resources/icons/Icon~ipad.png',
        '114': 'resources/icons/Icon@2x.png',
        '144': 'resources/icons/Icon~ipad@2x.png'
    },*/

    isIconPrecomposed: true,

    startupImage: {
        '320x460': 'resources/startup/sinbox.jpg',
        '640x920': 'resources/startup/sinbox.jpg',
        '768x1004': 'resources/startup/sinbox.jpg',
        '748x1024': 'resources/startup/sinbox.jpg',
        '1536x2008': 'resources/startup/sinbox.jpg',
        '1496x2048': 'resources/startup/sinbox.jpg'
    },
	
	launch: function() {
	//setting up database
	intializeDataBase();	

	//TAB 1 Tab panel
	
		var tab1TabPanel = Ext.create('Ext.TabPanel', {
            title: 'Inbox',
            iconCls: 'star',
            displayField: 'title',
			id : 'tab1TabPanel',
			items: [],
			listeners: {
	            initialize:function(){
	                this.addAfterListener("activeitemchange",function(){

	                			Ext.Viewport.setMasked({xtype:'loadmask',message:'loading....'});	
	                			
	                		    var task = Ext.create('Ext.util.DelayedTask', function () {
	                		    	Ext.Viewport.setMasked(false);
	                		    });
	                			
	                		    task.delay(5000);
	               });
	            }
				}
		});	
		
	      var horizontalCarousel_1 =   Ext.create('Ext.Carousel', {
	            defaults: {
	                styleHtmlContent: true
	            }, // defaultseen
	            items:[
	   				{
		                html:  [ 
		                        "<h3>What is super inbox ?</h3>",
		                        "<p>Super inbox is an application which is categorizing your incoming SMS based on the prior knowledge and organize the SMS based on the category of the message.</p><br><p>(Navigate to left for more info..)</p>"
		                        ],
						cls: 'home',
						styleHtmlContent: true
		            },{
		                html:  [ 
		                        "<h3>Problem we have</h3>",
		                        '<img src="./img/problem_1.png" width="250" height="250"/>'
		                        ],
						cls: 'home',
						styleHtmlContent: true
		            }, {
		                html:  [ 
		                        "<h3>What sinbox do.</h3>",
		                        '<img src="./img/problem_2.png" width="250" height="250"/>'
		                        ],
						cls: 'home',
						styleHtmlContent: true
		            },{
		                html:  [ 
		                        "<h3>The out come.</h3>",
		                        '<img src="./img/problem_3.png" width="250" height="250"/>'
		                        ],
						cls: 'home',
						styleHtmlContent: true
		            }
	            ] 
	        });	
			
			 var verticalCarousel = Ext.create('Ext.Carousel', {
		            fullscreen: true,
		            direction: 'vertical',

		            defaults: {
		               // styleHtmlContent: true
		            },

		            items: [{
		                html:  [ //'<img src="http://staging.sencha.com/img/sencha.png" />',
		                        "<h1>Welcome to Sinbox</h1>",
		                        "<p>After following this help menue, you will be able to  ",
		                        "understand the concept of super inbox and will be able to use it effectivly.</p>",
		                        "<br> <h3>How to use this help ? </h3> <p>Swap up , down , left or right to navigate to help contets.</p> "
		                        ],
						cls: 'home',
						styleHtmlContent: true
		            },horizontalCarousel_1
					]
		        });
				
				var tab3TabPanel = Ext.create('Ext.TabPanel', {
		            title: 'Info',
		            iconCls: 'info',
		            displayField: 'title',
					id : 'tab3TabPanel',
					items: [verticalCarousel]
				});	

	
	//TAB 2 FORM (Settings)
	//Dash board List 
	//add category panel 
        var addCategoryPanel = new Ext.Panel({
            //floating: true,
            centered: true,
            modal: true,
            width: '95%',
            height: '95%',
            styleHtmlContent: true,
            items: [{
                xtype: 'toolbar',
                title: 'Add New Category',
                items: [{
                    xtype: 'spacer'
                },{
                    text: 'Close',
                    handler: function(){
                        addCategoryPanel.hide();
                    }
					
                }
				]
            }
			,{
				xtype : 'fieldset',
				instructions: '(*) REQUIRED',
				items: [
					{
						xtype: 'textfield',
						name : 'categoryId',
						id : 'categoryId',
						label: 'Name *'
					},
					{
						xtype: 'textareafield',
						label: 'Desc..',
						maxRows: 3,
						name: 'categoryDescription',
						id : 'categoryDescriptionId'
                    },
					{
                        xtype: 'selectfield',
                        name: 'planeRank',
                        label: 'Rank *',
						id : 'categoryRank',
                        valueField: 'rank',
                        displayField: 'title',
                        store: {
                            data: [
                                { rank: 'superhigh', title: 'Super High'},
                                { rank: 'high', title: 'High'},
                                { rank: 'avarage', title: 'Avarage'},
                                { rank: 'low', title: 'Low'}
                            ]
                        }
                    }
				]
				},
				{
                xtype: 'toolbar',
                items: [{
                    xtype: 'spacer'
                },{
                    text: 'Reset',
                    handler: function(){
						
                        addCategoryPanel.hide();
						
                    }
					
                },
				{
                    text: 'Add',
                    handler: function(){
						var name = Ext.getCmp("categoryId").getValue();
									var rank = Ext.getCmp("categoryRank").getValue();
									
									//validating required fields
									if((name == null || name.trim().length < 1 ) || 
										(rank == null || rank.trim().length < 1) )
										{
										Ext.Msg.alert(errorTitle, 'Missing Required Fields', Ext.emptyFn);
										}
									else
										{
										var category = Ext.create('Category', {
											name: name,
											priority: rank,
											active: '1',
											probability:0.0,
											planeId:lastSavedPlaneDid
											
										});
										sinbox.webdb.addCategory(category);							  
									    addCategoryPanel.hide();
									    
									   // 
									    var existingValue = Ext.getCmp('addedCategoryList_id').getValue();
									    Ext.getCmp('addedCategoryList_id').setValue(existingValue+ ' | '+ name);
									    
									}
                       
                    }
					
                }
				]
                }
			]
        });
	
	//end of add category sheet 
	

	//End of dash board list
	//Add edit form panel
	var addEditPlanePanel = Ext.create('Ext.form.Panel', {
		title: 'Add',
		iconCls: 'add',
		items: [
			{
				xtype: 'fieldset',
				title: 'Basic Plan Information',
				instructions: '(*) REQUIRED',
				items: [
					{
						xtype: 'textfield',
						name : 'planeId',
						id : 'planeId',
						label: 'Name *',
						listeners: {
							blur: {
								fn: function() {
									var planeId = Ext.getCmp("planeId").getValue();
									//sinbox.webdb.isPlaneExsist(planeId);
									sinbox.webdb.getPlaneByName(planeId,isPlaneExist_Success,Ext.emptyFn);
									
								}
							}
						}
					},
					{
						xtype: 'textfield',
						name : 'planeDescription',
						id : 'planeDescription' ,
						label: 'Desc.. *'
					},
					{
                        xtype: 'selectfield',
                        name: 'planeRank',
                        label: 'Rank *',
						id : 'planeRank',
                        valueField: 'rank',
                        displayField: 'title',
                        store: {
                            data: [
                                { rank: 'superhigh', title: 'Super High'},
                                { rank: 'high', title: 'High'},
                                { rank: 'avarage', title: 'Avarage'},
                                { rank: 'low', title: 'Low'}
                            ]
                        }
                    },
					{
							xtype: 'spacer',
							height: 5
					},
					Ext.create('Ext.Container', {
					layout: {
						type: 'vbox',
						align: 'right'
					},
					items: [{
						xtype: 'toolbar',
						docked: 'top',
						items: [{
									text: 'Reset',
									id :'resetAddNewId' ,
									handler : function(btn){
									//re set fields and category list
									Ext.getCmp("planeId").reset();
									Ext.getCmp("planeDescription").reset(); 
									Ext.getCmp("planeRank").reset();
									Ext.getCmp("addCategoryId").setDisabled( true );
									
									}
						}, {
							xtype: 'spacer',
							width: 50
						}, {
									text: 'Add Plane',
									id :'addNewPlaneId' ,
									handler : function(btn){

									var name = Ext.getCmp("planeId").getValue();
									var desc = Ext.getCmp("planeDescription").getValue(); 
									var rank = Ext.getCmp("planeRank").getValue();
									
									//validating required fields
									if((name == null || name.trim().length < 1 ) || 
										(desc == null || desc.trim().length < 1) || 
										(rank == null || rank.trim().length < 1) )
										{
										Ext.Msg.alert(errorTitle, 'Missing Required Fields', Ext.emptyFn);
										}
									else
										{
										var plane = Ext.create('Plane', {
											name: name,
											active: 0,
											state: 'CREATED',
											priority: rank,
											description: desc
										});
										sinbox.webdb.addPlane(plane);								  
									
									}
									}
						}]
					}]
				})
					
				]
			},
			{
				xtype: 'fieldset',
				title: 'Current Categories',
				layout: {
                        type: 'fit'
                },
				//instructions: 'Tell us all about yourself',
				items: [
					Ext.create('Ext.Container', {
						//fullscreen: true,
						padding: 1,
						defaults: {
							disabled : true
						},
						layout: {
							type: 'vbox',
							align: 'right'
						},
					items: [{
						xtype: 'toolbar',
						docked: 'top',
						align : 'right',
						items: [{
									text: 'Add Category',
									id :'addCategoryId' ,
									disabled : true,
									handler : function(btn){
									if(lastSavedPlaneName != null && lastSavedPlaneName.trim().length > 1){
										//get last saved plane did
										sinbox.webdb.getPlaneByName(lastSavedPlaneName,getLastSavedPlaneByName_Success,Ext.emptyFn);
										//open add category window 
										addCategoryPanel.showBy(btn);
									}else{
										Ext.Msg.alert(errorTitle, 'Unable to find saved plane informations.', Ext.emptyFn);
									}
									}
						}]
					}]
					}),
					{
						xtype : 'fieldset',
						title : 'Associated Categories',
						items: [                        
							{
								xtype: 'textfield',
								name : 'addedCategoryList_name',
								id : 'addedCategoryList_id',
								disabled : true
							}
			            ]
						}
					
				]
			},
				{
                    xtype: 'fieldset',
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
							displayValue : 'id' ,
					        //itemTpl: '<div class="contact">{id} <strong>{id}</strong></div>',
							itemTpl: '<tr><td>AA</td></tr>'
                        }
                    ]
                }
			],
			listeners: {
					deactivate : function() {			
					lastSavedPlaneName = '';
					lastSavedPlaneDid = -1;
					Ext.getCmp('addCategoryId').setDisabled(true);
					}
				}
						
	});
		
		//end of Data grid of categories in add edit panel

	//Info panel 
    var infoPanel = new Ext.Panel({
        //floating: true,
        centered: true,
        modal: true,
        width: '100%',
        height: '100%',
        styleHtmlContent: true,
        items: [{
            xtype: 'toolbar',
            title: 'Plane Info',
            items: [{
                xtype: 'spacer'
            },{
                text: 'Close',
                handler: function(){
                	infoPanel.hide();
					sinbox.webdb.getAllPlane(dashBoardPlaneRender);
                }
				
            }
			]
        }
		,{
			xtype : 'fieldset',
			title : 'Plane Info',
			items: [
				{
					xtype: 'textfield',
					name : 'planeId_info',
					id : 'planeId_info',
					disabled : true,
					label: 'Name '
				},
				{
					xtype: 'textareafield',
					label: 'Description',
					maxRows: 1,
					disabled : true,
					name: 'planeDescription_info',
					id : 'planeDescription_info'
                },
				{
					xtype: 'textfield',
					name : 'planeRank_info',
					id : 'planeRank_info',
					disabled : true,
					label: 'Rank '
				},
				{
					xtype: 'textfield',
					name : 'planeStatus_info',
					id : 'planeStatus_info',
					disabled : true,
					label: 'Op mood '
				}
			]
			},
			{
			xtype : 'fieldset',
			title : 'Associated Categories',
			items: [                        
				{
					xtype: 'textfield',
					name : 'planeCategoryList_info',
					id : 'planeCategoryList_info',
					disabled : true
				}
            ]
			}
		],
		listeners: {
			show : function() {		
				//alert('existingPlaneStore '+existingPlaneStore.getCount());
				if(selectedPlaneRecord != null) {
					Ext.getCmp('planeId_info').setValue(selectedPlaneRecord.get('name'));
					Ext.getCmp('planeDescription_info').setValue(selectedPlaneRecord.get('description'));
					Ext.getCmp('planeRank_info').setValue(selectedPlaneRecord.get('priority'));
					Ext.getCmp('planeStatus_info').setValue(selectedPlaneRecord.get('state'));
					
					var categoryListText = '';
					var db = sinbox.webdb.db;
					db.transaction(function(tx){
						var sql = "SELECT * FROM Category WHERE planeId =?";
						tx.executeSql(sql,[selectedPlaneRecord.get('id')],
								
							
							function(tx,rs) {
								for ( var i = 0; i < rs.rows.length; i++) {
									var currentItem = rs.rows.item(i);
									categoryListText = categoryListText +currentItem.name+' | '; 
								}

								Ext.getCmp('planeCategoryList_info').reset();
								Ext.getCmp('planeCategoryList_info').setValue(categoryListText);

						},Ext.emptyFn)});

					
				}
				}
					}
    });	
	
	//add category panel 
        var configPlanePanel = new Ext.Panel({
            //floating: true,
            centered: true,
            modal: true,
            width: '100%',
            height: '100%',
            styleHtmlContent: true,
            items: [{
                xtype: 'toolbar',
                title: 'Configurations',
                items: [{
                    xtype: 'spacer'
                },{
                    text: 'Close',
                    handler: function(){
                        configPlanePanel.hide();
						sinbox.webdb.getAllPlane(planeConfigurationStoreRenderer);
                    }
					
                }
				]
            }
			,{
				xtype : 'fieldset',
				title : 'Plane Info',
				items: [
					{
						xtype: 'textfield',
						name : 'planeId_config',
						id : 'planeId_config',
						disabled : true,
						label: 'Name '
					},
					/*{
						xtype: 'textareafield',
						label: 'Description',
						maxRows: 1,
						disabled : true,
						name: 'planeDescription_config',
						id : 'planeDescription_config'
                    },
					{
						xtype: 'textfield',
						name : 'planeRank_config',
						id : 'planeRank_config',
						disabled : true,
						label: 'Rank '
					},*/
					{
						xtype: 'textfield',
						name : 'planeStatus_config',
						id : 'planeStatus_config',
						disabled : true,
						label: 'Status '
					}
				]
				},
				{
				xtype : 'fieldset',
				title : 'Operatio Mood and Message configurations',
				items: [
					{
						xtype: 'togglefield',
						name: 'trainingMode',
						id: 'trainingMode_id',
						label: 'On training mode',
						labelWidth: '60%',
						listeners: {
							dragstart : function() {		
								var toggleValue = new Number(Ext.getCmp('trainingMode_id').getValue());
								if(toggleValue == 0){
									//changePlaneState('TRAINING');
								//  sinbox.webdb.changeStateToTrainedIfPossible('TRAINING',setToTraining);
									setToTraining();
									}
									else if (toggleValue == 1){
								    setToTrained(setToTrained_Success_Train,setToTrained_Error_Train);
								}
						}
						}
					},
					{
						xtype: 'togglefield',
						name: 'applyMode',
						id: 'applyMode_id',
						label: 'On testing mode',
						labelWidth: '60%',
						listeners: {
							dragstart : function() {						
								var toggleValue = new Number(Ext.getCmp('applyMode_id').getValue());
								if(toggleValue == 0){
									setToTestingMood();
									}
									else if (toggleValue == 1){
								     setToTrained(setToTrained_Success_Apply,setToTrained_Error_Apply);
								}
						}
						}
                    },
					{
						xtype: 'togglefield',
						name: 'appliedMode',
						id: 'appliedMode_id',
						label: 'On apply mode',
						labelWidth: '60%',
						listeners: {
							dragstart : function() {						
								var toggleValue = new Number(Ext.getCmp('appliedMode_id').getValue());
								if(toggleValue == 0){
									setToApplyMood();
									}
									else if (toggleValue == 1){
								     setToTrained(setToTrained_Success_Apply,setToTrained_Error_Apply);
								}
						}
						}
                    }
				]
				},
				{
                    xtype: 'selectfield',
                    name: 'planeRank',
                    label: 'Number of Messages to be loaded',
					id : 'numberOfMessages',
                    valueField: 'value',
                    displayField: 'title',
                    labelWidth: '60%',
                    store: {
                        data: [
                           { value: 500, title: '500'},
                           { value: 1000, title: '1000'}
                        ]
                    },
					listeners: {
						change : function() {						
							var numberOfMessages = Ext.getCmp("numberOfMessages").getValue();
							//alert(' numberOfMessages  '+ numberOfMessages );
							saveString('MESSAGES_COUNT',''+numberOfMessages); //
					}
					}
                }
			],
			listeners: {
				show : function() {		
				//setting disabled fields
				if(selectedPlaneRecord != null) {
				Ext.getCmp('planeId_config').setValue(selectedPlaneRecord.get('name'));
				Ext.getCmp('planeStatus_config').setValue(selectedPlaneRecord.get('state'));
				var status =  selectedPlaneRecord.get('state');
				Ext.getCmp('trainingMode_id').setValue(0);
				Ext.getCmp('applyMode_id').setValue(0);
				
				var messageCount = getString('MESSAGES_COUNT');
				
				if(messageCount != null){
					
					Ext.getCmp('numberOfMessages').setValue(parseInt(messageCount));
				}
				
					if(status == 'TRAINING'){
						Ext.getCmp('trainingMode_id').setValue(1);
					}else if (status == 'TESTING'){
						Ext.getCmp('applyMode_id').setValue(1);
					}else if (status == 'APPLIED'){
						Ext.getCmp('appliedMode_id').setValue(1);
					}else{
						Ext.getCmp('appliedMode_id').setValue(0);
					}
					}
								}
						}
        });		
		
		var configurationPanel = Ext.create('Ext.form.Panel', {
			title: 'Configure',
			iconCls: 'refresh',
			items: [
				{
                    xtype: 'fieldset',
                    layout: {
                        type: 'fit'
                    },
					iconCls: 'home',
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
							itemTpl: '<tr><td>AA</td></tr>',
                        }
                    ]
                }
			]
		});
	
		var tab2TabPanel = Ext.create('Ext.TabPanel', {
              title: 'Settings',
              iconCls: 'settings',
              displayField: 'title',

			items: [
				{
                    xtype: 'fieldset',
                    layout: {
                        type: 'fit'
                    },
					title: 'Home',
					iconCls: 'home',
					
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
							id : 'planeListId_info',
					        itemTpl: '<div><button title="click after select messages" type="button"><img src="./img/resources/icons/Minus-icon.png" width="20" height="20" onclick="disablePlane({id})")"></img></button><strong>{name}</strong></div>',
							listeners : {
								itemtaphold : function(btn){  
									var selection = Ext.getCmp('planeListId_info').getSelection( );
									selectedPlaneRecord = selection[0];
									infoPanel.showBy(btn);
									}
							}
                        }
                    ],
					listeners: {
						activate : function() {
							//load all planes and populate the store 
							sinbox.webdb.getAllPlane(dashBoardPlaneRender);
						}
					}
                },
				addEditPlanePanel,
				{
                    xtype: 'fieldset',
                    layout: {
                        type: 'fit'
                    },
					title: 'Configure',
					iconCls: 'refresh',
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
							id : 'planeListId_conf',
							itemTpl: '<div><strong>{name}</strong></div>',
							listeners : {
								select : function(btn){  
								//
								var selection = Ext.getCmp('planeListId_conf').getSelection( );
								selectedPlaneRecord = selection[0];
									configPlanePanel.showBy(btn);
								}
							}
                        }
                    ],
					listeners: {
						activate : function() {
							//load all planes and populate the store 
							sinbox.webdb.getAllPlane(planeConfigurationStoreRenderer);
						}
					}
                }

			]
		});
		 
	// MAIN NAVIGATION TAB PANNEL		
        Ext.create("Ext.TabPanel", {
            fullscreen: true,
            tabBarPosition: 'bottom',
            items: [tab3TabPanel,tab1TabPanel, tab2TabPanel ],
            listeners:{
            initialize:function(){
             //	this.tabs.getComponent(1).setBadge('Test');
/*               	setInterval(function(){//alert("Hello");
               	this.tabs.tabBar.getComponent(1).setBadge('Test');
               	//Ext.getCmp('tab1TabPanel').setBadge('hi');
      		
               	},1000);*/
               	
                this.addAfterListener("activeitemchange",function(){
                	 if(this.getActiveItem().config.title =="Inbox"){
                		// alert('Move to inbox')
                			Ext.Viewport.setMasked({xtype:'loadmask',message:'loading....'});	
                			
                		    var task = Ext.create('Ext.util.DelayedTask', function () {
                		    	Ext.Viewport.setMasked(false);
                		    });
                			
                		    task.delay(10000);
                		 intialzeInboxTab();
                	 }
               });
            }
        }
			
			});
	}

});
//hg push https://amith23@bitbucket.org/amith23/sinbox