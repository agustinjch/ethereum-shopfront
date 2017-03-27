pragma solidity ^0.4.8;

import "Owned.sol";

contract Shopfront is Owned {
	event LogProductAdded(uint id, bytes32 name, uint price, uint stock);
	event LogProductRemoved(uint id, bytes32 name, uint price, uint stock);
	event LogProductPurchased(uint id, address customer, uint stock, uint cashDifference);
	event LogWithdrawedValue(uint valueToSend, uint contractValue);

	struct Product {
		bytes32 name;
		uint price;
		uint stock;
		uint index;
	}

	mapping(uint => Product) private products;
	uint[] private ids;

	function Shopfront() {
	}

	function getProductCount() constant returns (uint length) {
		return ids.length;
	}

	function getProductIdAt(uint index)
		constant
		returns (uint id) {
		return ids[index];
	}

	function getProduct(uint id)
		constant
		returns (bytes32 name, uint price, uint stock) {
		Product product = products[id];
		return (
			product.name,
			product.price,
			product.stock);
	}

	function addProduct(uint id, bytes32 name, uint price, uint stock)
		fromOwner
		returns (bool successful) {
		if (products[id].price != 0)
			return false;
		products[id] = Product({
			name: name,
			price: price,
			stock: stock,
			index: ids.length
		});
		uint arrayLength = ids.push(id);
		ids.length = arrayLength;
		LogProductAdded(id, name, price, stock);
		return true;
	}

	function removeProduct(uint id)
		fromOwner
		returns (bool successful) {
			Product product = products[id];
			LogProductRemoved(id,  product.name,  product.price,  product.stock);
			for (uint i = 0; i<ids.length-1; i++){
				if (ids[i] == id){
					// Get the product index in the ids array, and set it.
					products[i].index = products[id].index;
					// Remove the product to delete
					delete products[id];
					// set the last id in the position of the removed product.
					ids[i] = ids[ids.length - 1];
					// Remove the last id of the ids array, because we moved it to the position of the deleted product.
					delete ids[ids.length-1];
			        ids.length--;	        
					return true;
				}
			}

			
	}

	function withdrawMoney(uint valueToSend)
		fromOwner
		returns (bool successful) {
		if (valueToSend > this.balance) throw;
		if (!msg.sender.send(valueToSend)) throw;
		LogWithdrawedValue(valueToSend, this.balance);
		return true;
	}

	function buyProduct(uint id)
		payable
		returns (bool successful) {
		if (products[id].price == 0) throw;

		if (products[id].stock == 0) throw;

		if (msg.value < products[id].price)	throw;

		uint valueDifference = msg.value - products[id].price;
		
		if (valueDifference > 0){
			if (!msg.sender.send(valueDifference)) throw;	
		}

		products[id].stock = products[id].stock - 1;

		LogProductPurchased(id, msg.sender, products[id].stock, valueDifference);
		
		return true;
	}
}