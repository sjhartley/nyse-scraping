const axios = require('axios');
const readline = require('readline');

var get_options={
  method: 'GET',
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  }
}

var post_options={
  method: 'POST',
  withCredentials: true,
  headers: {
    "User-Agent": "Mozilla/5.0",
  }
}

//create interface for command line with input and output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function menu(){
  var func_arr = [
    nyse_get,
  ];

  var command_Stuff = new Object();

  console.log(Object.values(func_arr));
  //prompt user to enter command
  rl.question("Enter the command: ", function(command){
    command_Stuff.command=command;
    command=command.toLowerCase().split(' ')[0];
    for(var i=0; i<func_arr.length; i++){
      if(command === func_arr[i].name.toLowerCase()){
        return func_arr[i](command_Stuff);
      }
    }
    console.log("Invalid command!!!");
    menu();
  });
}

//this function is used to prompt the user to return to the menu or not
function return_menu(){
  var valid_choices = ["y", "n"];
  rl.question("\n\nDo you wish to return to the menu(y/n): ", function(arg){
    arg = arg.toLowerCase();
    if(valid_choices.includes(arg)){
      if(arg === valid_choices[0]){
        menu();
      }
      else{
        console.log("Done...");
        rl.close();
      }
    }
    else{
      console.log("Invalid input!!!");
      return_menu();
    }
  });
}

function line_generator(line_char, line_length){ //generate a line using a character and set the length
  var line=line_char;
  for(var i=0; i<line_length; i++) {
    line = line + line_char;
  }
  return line; //return the generated line
}

function tag_remover(str){
  if(str.search(/\</i) !== -1){
    while(str.search(/\</i) !== -1){
      var bracket_pos_1 = str.search(/\</i);
        var bracket_pos_2 = str.search(/\>/i);
        var str_remove = str.slice(bracket_pos_1, bracket_pos_2+1);
        str = str.replace(str_remove, '');
    }
  }
  return str;
}

function nyse_get(command_Stuff){

  var keyWord=command_Stuff.command;
  if(typeof keyWord.split('--kw ')[1] !== 'undefined'){
    keyWord=keyWord.split('--kw ')[1].split(' --')[0];
  }

  var url="https://www.nyse.com/api/quotes/filter";
  var payload={"instrumentType":"EQUITY","pageNumber":1,"sortColumn":"NORMALIZED_TICKER","sortOrder":"ASC","maxResultsPerPage":1,"filterToken":""};
  post_options.url=url;
  post_options.data=payload;

  if(keyWord.search("--help") !== -1){
    var help_str=
    `1. nyse_get --kw <company name or ticker>: get company stock market data_arr\n2. nyse_get --l <list all companies\n3. nyse_get --help: show help section`;

    console.log(help_str);
    return_menu();
    return false;
  }

  axios(post_options).then(function(response){
    var data=response.data;
    console.log(data);
    //retrieve the total number of entries
    var total=data[0].total;
    console.log(`total: ${total}`);
    //alter the payload so that all entries can be accessed
    payload["maxResultsPerPage"]=total;
  }).then(function(){
    //a HTTP POST request is required
    post_options.data=payload;
    axios(post_options).then(function(response){
      var data=response.data;
      for(var i=0; i<data.length; i++){
        //if the keyword entered by the user matches the company name or ticker
        if((data[i]["instrumentName"].toLowerCase().search(keyWord.toLowerCase()) !== -1) || (data[i]["symbolTicker"].toLowerCase().search(keyWord.toLowerCase()) !== -1)){
          console.log(data[i]);
          const ticker=data[i]["symbolTicker"];

          //this url is used to obtain the authentication key
          var td_url="https://www.nyse.com/api/idc/td";

          //to authenticate we must insert the key into the authentication url
          var authUrl_start="https://nyse.widgets.dataservices.theice.com/Login?auth=";
          var authUrl_end="&browser=false&client=mobile&callback=__gwt_jsonp__.P0.onSuccess";

          axios.get(td_url).then(function(response){
            var data=response.data;
            console.log(response.headers);
            var auth=data['td'].toString().split('=')[0];
            var search_chars=['/', '\\+'];
            console.log(auth);

            //the authentication key needs to be encoded before it can be used
            auth=encodeURIComponent(auth);

            console.log(`auth=${auth}`);
            //insert the encoded authentication key
            var auth_url=`${authUrl_start}${auth}${authUrl_end}`;
            console.log(`auth_url: ${auth_url}`);

            get_options.url=auth_url;

            axios(get_options).then(function(response){
              var data=response.data.toString();
              console.log(data);
              //obtain cbid
              var cbid=data.split('"cbid":')[1].split('"')[1];
              console.log(cbid);
              var search_chars=['/', '\\+'];
              //obtain session key
              var session_key=encodeURIComponent(data.split('"webserversession":')[1].split('"')[1].split(',')[1].split('=')[0], search_chars);
              console.log(session_key);

              var datasets=["MQ_Fundamentals", "DividendsHistory"];
              for(var i=0; i<datasets.length; i++){
                console.log(`datasets=${datasets[i]}\n\n\n`);
                dataset_fetch(datasets[i], ticker, session_key, cbid);
              }
              snapshot_get(ticker, session_key, cbid);
            });
          });
          break;
        }
        else if(keyWord.search("--l") !== -1){
          console.log(i);
          console.log(`${data[i]["instrumentName"]}`);
          if(i === (payload["maxResultsPerPage"])-1){
            return_menu();
          }
        }
      }
    });
  });

}

function snapshot_get(ticker, session_key, cbid){
  var url=`https://data2-widgets.dataservices.theice.com/snapshot?symbol=${ticker}&type=stock&username=nysecomwebsite&key=${session_key}&cbid=${cbid}`;

  get_options.url=url;

  axios(get_options).then(function(response){
    var body=response.data;
    var new_line_split=body.split('\n');

    var data_arr=[];
    for(var i=0; i<new_line_split.length; i++){
      if(new_line_split[i].search("=") !== -1){
        var dataObj=new Object();
        dataObj[new_line_split[i].split('=')[0]]=new_line_split[i].split('=')[1];
        data_arr.push(dataObj);
      }
    }
    console.log(data_arr);
  });
}

function dataset_fetch(dataset, ticker, session_key, cbid){
  var dataUrl_start="https://data2-widgets.dataservices.theice.com/fsml?requestType=content&username=nysecomwebsite&key=";
  var dataUrl_end=`&dataset=${dataset}&fsmlParams=key%3D${ticker}&json=true`;

  var dataUrl=`${dataUrl_start}${session_key}&cbid=${cbid}${dataUrl_end}`;
  console.log(dataUrl);

  get_options.url=dataUrl;

  axios(get_options).then(function(response){
    var data=response.data;
    console.log(data);
  }).then(function(){
    return_menu();
  });
}

menu();
