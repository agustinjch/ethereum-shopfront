// Found here https://gist.github.com/xavierlepretre/88682e871f4ad07be4534ae560692ee6
web3.eth.getTransactionReceiptMined = function (txnHash, interval) {
  var transactionReceiptAsync;
  interval = interval ? interval : 500;
  transactionReceiptAsync = function(txnHash, resolve, reject) {
    try {
      var receipt = web3.eth.getTransactionReceipt(txnHash);
      if (receipt == null) {
        setTimeout(function () {
          transactionReceiptAsync(txnHash, resolve, reject);
        }, interval);
      } else {
        resolve(receipt);
      }
    } catch(e) {
      reject(e);
    }
  };

  return new Promise(function (resolve, reject) {
      transactionReceiptAsync(txnHash, resolve, reject);
  });
};

// Found here https://gist.github.com/xavierlepretre/afab5a6ca65e0c52eaf902b50b807401
var getEventsPromise = function (myFilter, count) {
  return new Promise(function (resolve, reject) {
    count = count ? count : 1;
    var results = [];
    myFilter.watch(function (error, result) {
      if (error) {
        reject(error);
      } else {
        count--;
        results.push(result);
      }
      if (count <= 0) {
        resolve(results);
        myFilter.stopWatching();
      }
    });
  });
};

// Found here https://gist.github.com/xavierlepretre/d5583222fde52ddfbc58b7cfa0d2d0a9
var expectedExceptionPromise = function (action, gasToUse) {
  return new Promise(function (resolve, reject) {
      try {
        resolve(action());
      } catch(e) {
        reject(e);
      }
    })
    .then(function (txn) {
      return web3.eth.getTransactionReceiptMined(txn);
    })
    .then(function (receipt) {
      // We are in Geth
      assert.equal(receipt.gasUsed, gasToUse, "should have used all the gas");
    })
    .catch(function (e) {
      if ((e + "").indexOf("invalid JUMP") > -1) {
        // We are in TestRPC
      } else {
        throw e;
      }
    });
};

contract('Shopfront', function(accounts) {

  it("should start with empty product list", function() {
    var shopfront = Shopfront.deployed();

    return shopfront.getProductCount.call()
	    .then(function(count) {
	      assert.equal(count.valueOf(), 0, "should start with no product");
	    });
  });

  it("should not add a product if not owner", function() {
    var shopfront = Shopfront.deployed();

    return expectedExceptionPromise(function () {
			return shopfront.addProduct.call(1, "shirt", 10, 1,
				{ from: accounts[1], gas: 3000000 });    	
	    },
	    3000000);
  });

  it("should be possible to add a product", function() {
    var shopfront = Shopfront.deployed();
    var blockNumber;

    return shopfront.addProduct.call(1, "shirt", 10, 1, { from: accounts[0] })
      .then(function(successful) {
        assert.isTrue(successful, "should be possible to add a product");
        blockNumber = web3.eth.blockNumber + 1;
        return shopfront.addProduct(1, "shirt", 10, 1, { from: accounts[0] });
      })
      .then(function(tx) {
        return Promise.all([
          getEventsPromise(shopfront.LogProductAdded(
            {},
            { fromBlock: blockNumber, toBlock: "latest" })),
          web3.eth.getTransactionReceiptMined(tx)
        ]);
      })
      .then(function (eventAndReceipt) {
        var eventArgs = eventAndReceipt[0][0].args;
        assert.equal(eventArgs.id.valueOf(), 1, "should be the product id");
        assert.equal(eventArgs.name, "shirt", "should be the product name");
        assert.equal(eventArgs.price.valueOf(), 10, "should be the product price");
        assert.equal(eventArgs.stock.valueOf(), 1, "should be the product stock");
        return shopfront.getProductCount.call();
      })
      .then(function(count) {
        assert.equal(count.valueOf(), 1, "should have add a product");
        return shopfront.getProductIdAt(0);
      })
      .then(function (id) {
        assert.equal(id.valueOf(), 1, "should be the first id");
        return shopfront.getProduct(1);
      })
      .then(function(values) {
        assert.equal(values[0], "shirt", "should be the product name");
        assert.equal(values[1].valueOf(), 10, "should be the product price");
        assert.equal(values[2].valueOf(), 1, "should be the product stock");
        blockNumber = web3.eth.blockNumber + 1;
        return shopfront.addProduct(2, "shorts", 15, 20, { from: accounts[0] });
      })
      .then(function(tx) {
        return Promise.all([
          getEventsPromise(shopfront.LogProductAdded(
            {},
            { fromBlock: blockNumber, toBlock: "latest" })),
          web3.eth.getTransactionReceiptMined(tx)
        ]);
      })
      .then(function (eventAndReceipt) {
        var eventArgs = eventAndReceipt[0][0].args;
        assert.equal(eventArgs.id.valueOf(), 2, "should be the product id");
        assert.equal(eventArgs.name, "shorts", "should be the product name");
        assert.equal(eventArgs.price.valueOf(), 15, "should be the product price");
        assert.equal(eventArgs.stock.valueOf(), 20, "should be the product stock");
        return shopfront.getProductCount.call();
      })
      .then(function(count) {
        assert.equal(count.valueOf(), 2, "should have add a product");
        return shopfront.getProductIdAt(1);
      })
      .then(function (id) {
        assert.equal(id.valueOf(), 2, "should be the first id");
        return shopfront.getProduct(2);
      })
      .then(function(values) {
        assert.equal(values[0], "shorts", "should be the product name");
        assert.equal(values[1].valueOf(), 15, "should be the product price");
        assert.equal(values[2].valueOf(), 20, "should be the product stock");
      });
  });


  it("should not be possible to purchase a product below price", function() {
    var shopfront = Shopfront.deployed();

    return expectedExceptionPromise(function () {
			return shopfront.buyProduct.call(
					1, 
					{ from: accounts[1], value: 9, gas: 3000000 });    	
		    },
		    3000000);

  });

  it("should be possible to purchase a product at exact price", function() {
    var shopfront = Shopfront.deployed();

    return shopfront.buyProduct.call(1, { from: accounts[1], value: 10 })
    	.then(function (successful) {
    		assert.isTrue(successful, "should be possible to purchase");
    	});

  });

   it("should be possible to remove a product", function() {
    var shopfront = Shopfront.deployed();
    var blockNumber;

    return shopfront.removeProduct.call(1, { from: accounts[0] })
      .then(function(successful) {
        assert.isTrue(successful, "should be possible to remove a product");
        blockNumber = web3.eth.blockNumber + 1;
        return shopfront.removeProduct(1, { from: accounts[0] });
      })
      .then(function(tx) {
        return Promise.all([
          getEventsPromise(shopfront.LogProductRemoved(
            {},
            { fromBlock: blockNumber, toBlock: "latest" })),
          web3.eth.getTransactionReceiptMined(tx)
        ]);
      })
      .then(function (eventAndReceipt) {
        var eventArgs = eventAndReceipt[0][0].args;
        assert.equal(eventArgs.id.valueOf(), 1, "should be the product id");
        assert.equal(eventArgs.name, "shirt", "should be the product name");
        assert.equal(eventArgs.price.valueOf(), 10, "should be the product price");
        assert.equal(eventArgs.stock.valueOf(), 1, "should be the product stock");
        return shopfront.getProductCount.call();
      })
      .then(function(count) {
        assert.equal(count.valueOf(), 1, "should have removed the product, so the count should be 1");
        return shopfront.getProductIdAt(0);
      })
      .then(function (id) {
        assert.equal(id.valueOf(), 2, "should be the first id");
        return shopfront.getProduct(2);
      })
      .then(function(values) {
        assert.equal(values[0], "shorts", "should be the product name");
        assert.equal(values[1].valueOf(), 15, "should be the product price");
        assert.equal(values[2].valueOf(), 20, "should be the product stock");
      });
  }); 
  
});