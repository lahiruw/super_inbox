//Database setting up
var sinbox = {};
    sinbox.webdb = {};
    sinbox.webdb.db = null;
var dbSize = 10*1024*1024; //10 MB
var dbName = 'sinbox';
var dbVersion = '1.0';
var dbDescription = 'sinbox data base';
var index = 1;

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

var TABLE_WORD_CATEGORY="CREATE TABLE Word_Category ("+
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

//TRIGGERS
var INCREMENT_MESSAGE_COUNT_BY_ONE=" CREATE TRIGGER TR_U_CATEGORY_CALCULATE_PROBABILITY " +
															  " AFTER UPDATE OF icon "+
															  " ON Category "+
															  " BEGIN "+
															  " UPDATE Category SET messageCount = (old.messageCount+new.messageCount) WHERE id = old.id ; "+
															  " INSERT INTO TMP_INT (V1)  SELECT SUM(messageCount) FROM Category WHERE planeId = old.planeId; "+
															  " UPDATE Category SET probability = ( CAST (messageCount AS REAL )/(SELECT V1 FROM TMP_INT) ) "+
															  "      WHERE planeId = old.planeId;  "+
															  " DELETE FROM TMP_INT; "+
															  " END; ";

CALCULATE_P1_P2 = " CREATE TRIGGER TR_U_CALCULATE_P1_P2 "+
												 " AFTER UPDATE OF changeDate "+
												 " ON Word_Category "+
												 " BEGIN  "+
												 " UPDATE Word_Category SET wordCount = ( old.wordCount+new.wordCount ) "+
												 " WHERE wordHash = old.wordHash AND planeId = old.planeId  AND categoryId = old.categoryId ; "+
												 " INSERT INTO TMP_INT(V1) SELECT SUM(wordCount) FROM Word_Category; "+
												 " UPDATE Word_Category SET totalCount = ( SELECT V1 FROM TMP_INT)  "+
												 " WHERE planeID = new.planeID ; "+
												 " DELETE FROM TMP_INT; "+
												 " INSERT INTO TMP_INT(V1) SELECT SUM(wordCount) FROM Word_Category  "+
												 " WHERE  planeId = old.planeId  AND categoryId = old.categoryId ; "+
												 " UPDATE Word_Category SET totalCountInCategory = ( SELECT V1 FROM TMP_INT) "+
												 " WHERE  planeId = old.planeId  AND categoryId = old.categoryId ; "+
												 " DELETE FROM TMP_INT; "+
												 " INSERT INTO TMP_INT(V1) SELECT SUM(wordCount) FROM Word_Category  "+
												 " WHERE  planeId = old.planeId  AND wordHash = old.wordHash ; "+
												 " UPDATE Word_Category SET totalCountForHash = ( SELECT V1 FROM TMP_INT)  "+
												 " WHERE  planeId = old.planeId AND wordHash = old.wordHash; "+
												 " DELETE FROM TMP_INT;  "+
												 " UPDATE Word_Category SET P2 = cast (totalCountForHash as real ) / totalCount "+
												 " WHERE planeId = new.planeId ;  "+
												 " UPDATE Word_Category SET P1 = cast (wordCount as real ) /  totalCountInCategory  "+
												 " WHERE planeId = new.planeId ;  "+
												 " END; ";															  


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


//Data models 

Ext.define('Plane', {
    extend: 'Ext.data.Model',

    config: {
        fields: [
            {name: 'name',  type: 'string'},
        ]
    }
});

//END of DATA models

//services and functions 
/*
Saving new plane
*/

sinbox.webdb.addPlane = function(todoText) {
		++index;
        var db = sinbox.webdb.db;
        db.transaction(function(tx){
          var addedOn = new Date();
          tx.executeSql("INSERT INTO Plane ( name,active,state,priority,description)values(?,?,?,?,?)",
              ['hiiii',1,'xx','tt','zz'],
              sinbox.webdb.onSuccess,
              sinbox.webdb.onError);
         });
      }
//
sinbox.webdb.onSuccess = function(tx, r) {
        // re-render the data.
        alert("There");
      }
	  
sinbox.webdb.onError = function(tx, e) {
        alert("There has been an error: " + e.message);
      }	  

Ext.Loader.setConfig({
    enabled: true,
	paths   : {
        'Ext.ux.touch.grid': './Ext.ux.touch.grid'
    }
});

Ext.application({

    name: 'Sinbox',
    //here we require any components we are using in our application
    requires: ['Ext.*'],
	
	launch: function() {
	//setting up database
	intializeDataBase();	
	
	//TAB 1 NESTED LIST (Inbox )
		var tab1NestedList =  Ext.create('Ext.NestedList',{
              title: 'Inbox',
              iconCls: 'star',
              displayField: 'title',
                    store: {
                        type: 'tree',

                        fields: [
                            'title', 'link', 'author', 'contentSnippet', 'content',
                            {name: 'leaf', defaultValue: true}
                        ],

                        root: {
                            leaf: false
                        },

                        proxy: {
                            type: 'jsonp',
                            url: 'https://ajax.googleapis.com/ajax/services/feed/load?v=1.0&q=http://feeds.feedburner.com/SenchaBlog',
                            reader: {
                                type: 'json',
                                rootProperty: 'responseData.feed.entries'
                            }
                        }
                    },

                    detailCard: {
                        xtype: 'panel',
                        scrollable: true,
                        styleHtmlContent: true
                    },

                    listeners: {
                        itemtap: function(nestedList, list, index, element, post) {
                            this.getDetailCard().setHtml(post.get('content'));
                        }
                    },
					badgeText: '400'
		});
	
	//TAB 2 FORM (Settings)
	//Dash board List 
	Ext.define('Contact', {
		extend: 'Ext.data.Model',
		config: {
			fields: ['firstName', 'lastName']
		}
	});
	
	Ext.define('Category', {
		extend: 'Ext.data.Model',
		config: {
			fields: ['id', 'lastName']
		}
	});

	var existingPlaneStore = Ext.create('Ext.data.Store', {
	   model: 'Category',
	   sorters: 'lastName',

	   grouper: {
		   groupFn: function(record) {
			   return record.get('lastName')[0];
		   }
	   },

	   data: [
		   { firstName: 'Tommy',   lastName: 'Maintz'  },
		   { firstName: 'Rob',     lastName: 'Dougan'  },
		   { firstName: 'Ed',      lastName: 'Spencer' },
		   { firstName: 'Jamie',   lastName: 'Avins'   },
		   { firstName: 'Aaron',   lastName: 'Conran'  }
	   ]
	});
	
	var existingCategoryStore =  Ext.create('Ext.data.Store',{
		model :'Category',
		sorters : 'id',
	    grouper: {
		   groupFn: function(record) {
			   return record.get('id')[0];
		   }
	   },
		data : [{id: 'cat1'},{id:'cat2'},{id:'cat3'},{id:'cat4'}]
	});
	
	//add category panel 
        var addCategoryPanel = new Ext.Panel({
            floating: true,
            centered: true,
            modal: true,
            width: '95%',
            height: '95%',
            styleHtmlContent: true,
            //html: 'Hello! I\'m a PopUp',
			//items : 
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
						label: 'Category Id *'
					},
					{
						xtype: 'textareafield',
						label: 'Description',
						maxRows: 3,
						name: 'categoryDescription',
						id : 'categoryDescriptionId'
                    },
					{
                        xtype: 'selectfield',
                        name: 'planeRank',
                        label: 'Category Rank *',
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
					xtype : 'button',
                    text: 'Reset',
					width : '15%',
                    handler: function(){
                        addCategoryPanel.hide();
                    }
					
                },
				{
					xtype: 'button',
                    text: 'Add',
					width : '15%',
                    handler: function(){
                        addCategoryPanel.hide();
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
		title: 'Add - Edit Plane',
		iconCls: 'add',
		items: [
			{
				xtype: 'fieldset',
				title: 'Basic Info',
				instructions: '(*) REQUIRED',
				items: [
					{
						xtype: 'textfield',
						name : 'planeId',
						id : 'planeId',
						label: 'Plane Name *'
					},
					{
						xtype: 'textfield',
						name : 'planeDescription',
						id : 'planeDescription' ,
						label: 'Plane Description'
					},
					{
                        xtype: 'selectfield',
                        name: 'planeRank',
                        label: 'Plane Rank *',
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
						//pack: 'center',
						align: 'right'
					},
					items: [{
						xtype: 'toolbar',
						docked: 'top',
						//align : 'right',
						items: [{
									xtype: 'button',
									ui: 'normal',
									text: 'Reset',
									id :'resetAddNewId' ,
									width : '15%',
									handler : function(btn){
									//re set fields and category list
									}
						}, {
							xtype: 'spacer',
							width: 50
						}, {
									xtype: 'button',
									ui: 'action',
									text: 'Add Plane',
									id :'addNewPlaneId' ,
									width : '15%',
									handler : function(btn){
									  //enable after successfully saved 
									  var addCategoryButton =  Ext.getCmp('addCategoryId');
									  addCategoryButton.enable();
									  
									  //clean form
									}
						}]
					}]
				})
					
				]
			},
			{
				xtype: 'fieldset',
				title: 'Categories',
				layout: {
                        type: 'fit'
                },
				//instructions: 'Tell us all about yourself',
				items: [
					Ext.create('Ext.Container', {
						//fullscreen: true,
						padding: 4,
						defaults: {
							xtype: 'button',
							margin: 5,
							disabled : true
						},
						layout: {
							type: 'vbox',
							align: 'right'
						},
					items: [{
						xtype: 'toolbar',
						docked: 'top',
						//align : 'right',
						items: [{
									xtype: 'button',
									ui: 'action',
									text: 'Add Category',
									id :'addCategoryId' ,
									width : '15%',
									disabled : true,
									handler : function(btn){
									//open add category window 
									addCategoryPanel.showBy(btn);
									}
						}]
					}]
					}),
					{
                            xtype: 'list',
							store: existingPlaneStore,
					        itemTpl: '<div class="contact">{firstName} <strong>{lastName}</strong></div>',
                    }
					
				]
			},
				{
                    xtype: 'fieldset',
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
					        itemTpl: '<div class="contact">{firstName} <strong>{lastName}</strong></div>',
                        }
                    ]
                }
			]
	});
		
		//end of Data grid of categories in add edit panel
		
		var configurationPanel = Ext.create('Ext.form.Panel', {
			title: 'Configure Plane',
			iconCls: 'refresh',
			items: [
				{
					xtype: 'fieldset',
					title: 'XXXXX XXXXX',
					instructions: 'Tell us all about yourself'
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
					title: 'Dash Board',
					iconCls: 'home',
                    items: [
                        {
                            xtype: 'list',
							store: existingPlaneStore,
					        itemTpl: '<div class="contact">{firstName} <strong>{lastName}</strong></div>',
                        }
                    ]
                },
				addEditPlanePanel,configurationPanel

			]
		});
		 
	// MAIN NAVIGATION TAB PANNEL		
        Ext.create("Ext.tab.Panel", {
            fullscreen: true,
            tabBarPosition: 'bottom',
            items: [tab1NestedList, tab2TabPanel ] 
			
			});
			
			/*
			//create an instance 
			var instance = Ext.create('User', {
    name: 'Ed',
    gender: 'Male',
    username: 'edspencer'
});
			*/
	}

});
	