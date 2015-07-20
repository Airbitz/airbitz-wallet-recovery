// Utility to Recover funds from an Airbitz HD Seed.

var bitcore = require('bitcore');
var Insight = require('bitcore-explorers').Insight;
var insight = new Insight();

var api = "https://insight.bitpay.com/api/";
var sweepUnconfirmed = true;
var HDPrivateKey = bitcore.HDPrivateKey;
var index;
var addressBlock = [];
var privKeySet = [];
var address;
var derived;
var minerFee = 0.0005;
var utos = []; // Everything spendable in HD Seed
var totalBalance = 0, tbInSatoshis = 0;
var blockSize = 200; // Chunk of addresses to check for at a time. Not to be confused with Bitcoin Blocks

// Per address
var unconfirmed = 0;
var totalReceived;
var used = true; // By default, assume addrs are used.

var hdPrivateKey;
var bitcoinB = '\u0E3F'; var mBitcoin = 'm'+'\u0E3F';

var empty = "Invalid entropy: must be an hexa string or binary buffer, got ", emptyResponse = "No Seed";
var invalidSeed = "Invalid entropy: at least 128 bits needed, got \"�\"", invalidResponse = "Invalid Seed";

// ** Process HD Seed ** 

function processSeed(prs){
	console.log("Start Processing Private Key");
	
	index = 0;
	addressBlock = [];
	privKeySet = [];
	utos = [];
	totalBalance = 0;
	
	hdPrivateKey = new HDPrivateKey.fromSeed(prs);
	
	setAddresses();
}
function setAddresses(){
	for(var x = 0;x <= blockSize ;x++){
		// Derive the next address.
		derived = hdPrivateKey.derive("m/0/0/" + index.toString());
		address = derived.privateKey.toAddress();
		privKeySet.push(derived.privateKey.toWIF());
		addressBlock.push(address.toString());
		
		index++;
	}
	setUTXOs(addressBlock);
}

function setUTXOs(arrayOfAddresses){
	arrayOfAddresses = getBlockAddresses(arrayOfAddresses);
	$.get(api + "addrs/" + arrayOfAddresses + "/utxo", function( data ) {
		extractUTOs(data);
		checkAddrBlock();
	});
}
function getBlockAddresses(arrayOfAddresses){
	var numOfAddrInBlock = (arrayOfAddresses.length - 1);
	arrayOfAddresses = arrayOfAddresses.slice((numOfAddrInBlock - blockSize),numOfAddrInBlock);
	arrayOfAddresses = arrayOfAddresses.join(); // Comma seperated addrs.
	
	return arrayOfAddresses;
}
function extractUTOs(data){
	for(x in data){
		utos.push(data[x]);
	}
}

function setTableBlock(){
	for(var x = 0;x <= blockSize ;x++){
		
	}
	$("#seed-info").removeClass("hidden");
}

function updateTable(seedIndex,address,amount,privateKey){
	$("#seed-info").children("tbody").append("<tr>"
										+ "<td>" + seedIndex + "</td>"
										+ "<td>" + address + "</td>"
										+ "<td>" + amount + "</td>"
										+ "<td>" + privateKey + "</td>"
										+ "</tr>"
										);								
}

function checkAddrBlock(){
	// Check that at least one addr in addressBlock has had money sent to it. i.e. been used.
	var startingPoint = (addressBlock.length-blockSize); // Nubmer of Addresses - Blocksize
	console.log(used);
	for(var counter = 0/*50 - 50 = 0;*/; counter <= blockSize; counter++){
		checkAddr(addressBlock[(counter + (startingPoint - 1))]);
	}
	if(used){
		setAddresses();
	} else { // If no used in block, then assume there's no more used addrs in the Seed, finish proccess.
		finishProcessingSeed();
	}
}
function checkAddr(addr){
	$.get( api + "addr/" + addr + "/totalReceived", function(data){
		totalReceived = data;
		unconfirmed = 0;
		if(sweepUnconfirmed){
			setUnconfirmed(addr);
		} else {
			checkIfUsed();
		}
	 });
}
function setUnconfirmed(addr){
	$.get( api + "addr/" + addr + "/unconfirmedBalance", function( data ) {
		if(data >= 0) { unconfirmed = data };
		checkIfUsed();
	});
}
function checkIfUsed(){
	console.log("Total Received and unconfirmed: " + (totalReceived + unconfirmed));
	if((totalReceived + unconfirmed) > 0){
		used = true;
	} else {
		used = false;
	}
}
function transErr(e){
	
	var response = "";
	
	switch(e) {
		case empty:
			response = emptyResponse;
			break;
		default:
			response = invalidResponse;
	}
	return response;
}

function finishProcessingSeed(){
	$(".loading-screen").toggleClass("hidden"); // Hide
	getBalance(utos);
	var totalToSend = (totalBalance - minerFee);
	console.log(totalBalance);
	$(".balance").text("Total To Send: " + bitcoinB + " " + totalToSend + " (Transaction Fee is " + minerFee + ")" );
	console.log("Finished Processing Seed");
}

function getBalance(arrayOfUtos){
	for(x in arrayOfUtos){
		totalBalance += arrayOfUtos[x].amount;
	}
	return totalBalance;
}

// ** SWEEP FUNDS ** 

function sweepFunds(toBTCAddr){
	console.log("Start Sweep");
	var transaction = createTransaction(toBTCAddr);
	console.log(transaction.serialize() );
  
  /*$.post(  api + "tx/send", transaction.serialize())
  .done(function( data ) {
    alert( "Transaction Sent: " + data );
  });*/
}
function createTransaction(addr){
    console.log("Miner Fee: " + btcToSatoshis(minerFee))
	var transaction = new bitcore.Transaction()
    .from(utos)          
    .to(addr, btcToSatoshis(totalBalance))
    .change(addr) // Send everything, even change for sweep
    .fee(btcToSatoshis(minerFee))
    .sign(privKeySet);
    return transaction;
}
function broadcastTx(tx){
	insight.broadcast(tx, function(err, returnedTxId) {
		if (err) {
			// Handle errors...
		} else {
			// Mark the transaction as broadcasted
			return returnedTxId;
		}
	});
}

function btcToSatoshis(btcAmt){
    return bitcore.Unit.fromBTC(btcAmt).toSatoshis()
}

$(function() {
	$( "#recover-button" ).click(function() {
		$(".loading-screen").toggleClass( "hidden"); // Show
		$(".error-screen").addClass( "hidden"); // Hide
		var input = $("#masterSeed").val();
		try{
			processSeed(input);
		} catch(e) {
			var errMes = transErr(e.message);
			console.log(e.message);
			$(".loading-screen").toggleClass( "hidden"); // Hide
			$(".error-screen").toggleClass( "hidden");
			$(".error-message").text(errMes);
		}
	});
	
	$("#sweep").click(function() {
		var useraddr = $("#btcAddr").val();
		sweepFunds(useraddr);
	});
});
