pragma solidity ^0.4.8;

import "Owned.sol";

contract Shopfront is Owned {
	event LogProductAdded(uint id, bytes32 name, uint price, uint stock);
	event LogProductRemoved(uint id, bytes32 name, uint price, uint stock);
	event LogProductId(uint id);
	event LogProductPurchased(uint id, address customer);

	struct Product {
		bytes32 name;
		uint price;
		uint stock;
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
		
		products[id] = Product({
			name: name,
			price: price,
			stock: stock
		});
		ids.push(id);
		LogProductAdded(id, name, price, stock);
		return true;
	}

	function removeProduct(uint id)
		fromOwner
		returns (bool successful) {
			Product product = products[id];
			LogProductRemoved(id,  product.name,  product.price,  product.stock);
			delete products[id];
			uint idsIndex = 0;
			for (uint i = 0; i<ids.length-1; i++){
				if (ids[i] == id){
					idsIndex = i;
				}
			}

			LogProductId(idsIndex);

			for (i = idsIndex; i<ids.length-1; i++){
	            ids[i] = ids[i+1];
	        }
	        delete ids[ids.length-1];
	        ids.length--;
			return true;
	}

	function buyProduct(uint id)
		payable
		returns (bool successful) {
		if (msg.value < products[id].price)	{
			throw;
		}
		LogProductPurchased(id, msg.sender);
		return true;
	}
}