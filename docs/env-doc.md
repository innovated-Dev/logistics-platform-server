    SECTION A 

import "dotenv/config"
or
import { config } from "dotenv"

config = ({
	path: '.env';
})

const Required = [
	"First_Api_key",
	"Second_Api_key",
	"Third_Api_key",
	"Fourth_Api_key",
	"Fifth_Api_key"
];

export function validateEnv(){
	const missing = Required.filter(each => !(process.env[each]));
  
LEARNING DOCS 
  /**
   * What filter function does here is that, it check in every strings of array anyone of this that passes the test and create new array of those that pass the test.
   * 
   * Here's the test: process.env already contained all the keys that are available in env files, so the REQUIRED ARRAY run the filter function to check if any of this of child array is available with the same thing in process.env so if is not available in the process.env create a new array of the strings of an array that are not are not in the process.env but available in required array called MISSING
   * 
   * SUMMARY THE FILTER JUST CHECK IF THE STRINGS IN THE REQUIRED ARRAY CORRELATE WITH THE PROCESS.ENV  
   */

  
	if(missing.length){
		console.log('This env files is missing \n' + missing.map(each => ` * ${each}`).join('\n'));
		process.exit(1);
	}

  /* NOW, we got a new array created earlier from the filter function named MISSING, so now the length of this array for example ["CLAT_API", "SURT"] there length is automatically 2, then return console.error message that missing required env concatenated with a new array mapped, as this array is mapped out into a new array with a dot in front of them, the join make the array string with a new line, so we have this output, "Missing required env vars:
     • CLAT_API
     • SURT" 
  */

if((process.env.Third_Api_key?.length ?? 0) < 32){
		console.error('The env files is not up to 32 char')
		process.exit(1);
	}

  /**
   * Here the if statement has to check the process.env files especially the JWT_SECRET length so ?? a nullish coalesing operator is a perform on this particular env files which checks if the left hand value is null or undefined it return the right hand values or otherwise it return, it return the left hand values, that is the JWT SECRET first undergo the first it is there or not if it is not there it return the value 0 and the value 0 is less 32 character so we have an error secondly if it is abut the value is not up to 32 chracter it shows error message except the jwt is 32 chars
   */

 	["Fourth_Api_key", "Fifth_Api_key"].forEach( each => {
		if(!process.env[each]){
			console.warn(`${each}: not set`);
		}
	 }
	)

  //THE LAST CHECK PERFORM HERE let's look into it
  /**
   * we have an array that contains ors_api_key, antropic_api_key, and admin_whatsapp, so in this array, the foreach loop is run on the array so now if statement check is perform if in the array each of the strings of an array represented with k parameter is not present in process.env file, return an error message to the console which says "Optional env not: ${k}";
   */
}
/**
 * so this overall check is run on in validateenv function so ifm so it check it properfly in any file where the env files will  be needed example server.js, cluster.js file and others
 * 
 * 
 * 1. i have a question concerning the cluster.js especilay it uses for multi core, i  want to know why is needed in this project, and when im going the ruht the code written in cluster.js i found the cluster.js say something about node instance i don't really get want instance really means
 * 2. my second question is that does the the node is single thread but there's also an event loop that handles request with async await
 * 
 * 3. what is difference between async await and promise and when are the uses
 * 
 * PLEASE IN BOTH TEACHNICAL AND PRACTICAL ASPECT THAT WE MAKE ACTAULLY UNDERSTAND WHAT IS HAPPENING AND ALSO CHECK MY EXPLAINATION ON VALIDATE ENV FUNCTION IF THERE;S ERROR IN MY EXPLANATION 
 */

 SECTION B