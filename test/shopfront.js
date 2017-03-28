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
      assert.strictEqual(receipt.gasUsed, gasToUse, "should have used all the gas");
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
  var shopfront;

  describe("testing user restrictions", function() {
    before('Deploy a new Shopfront contract', function() {
      return Shopfront.new({}, {from: accounts[0]})
      .then(function(_shopfront) {
        shopfront = _shopfront;
      });
    });

    it("should not add a product if not owner", function() {
      return expectedExceptionPromise(function () {
        return shopfront.addProduct(1, "shirt", 10, 1,
          { from: accounts[1], gas: 3000000 });     
        },
        3000000);
    });
  });

  describe("testing default values", function() {
    before('Deploy a new Shopfront contract', function() {
      return Shopfront.new({}, {from: accounts[0]})
      .then(function(_shopfront) {
        shopfront = _shopfront;
      });
    });

    it("should start with empty product list", function() {
      return shopfront.getProductCount.call()
        .then(function(count) {
          assert.strictEqual(count.toNumber(), 0, "should start with no product");
        });
    });
  });


  describe("Testing owner functions", function(){
    before('Deploy a new Shopfront contract', function() {
      return Shopfront.new({}, {from: accounts[0]})
      .then(function(_shopfront) {
        shopfront = _shopfront;
      });
    });

    it("should be possible to add a product", function() {
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
          assert.strictEqual(eventArgs.id.toNumber(), 1, "should be the product id");
          assert.strictEqual(web3.toUtf8(eventArgs.name), "shirt" , "should be the product name in bytes32");
          assert.strictEqual(eventArgs.price.toNumber(), 10, "should be the product price");
          assert.strictEqual(eventArgs.stock.toNumber(), 1, "should be the product stock");
          return shopfront.getProductCount.call();
        })
        .then(function(count) {
          assert.strictEqual(count.toNumber(), 1, "should have added a product");
          return shopfront.getProductIdAt(0);
        })
        .then(function (id) {
          assert.strictEqual(id.toNumber(), 1, "should be the first id");
          return shopfront.getProduct(1);
        })
        .then(function(values) {
          assert.strictEqual(web3.toUtf8(values[0]), "shirt" , "should be the product name in bytes32");
          assert.strictEqual(values[1].toNumber(), 10, "should be the product price");
          assert.strictEqual(values[2].toNumber(), 1, "should be the product stock");
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
          assert.strictEqual(eventArgs.id.toNumber(), 2, "should be the product id");
          assert.strictEqual(web3.toUtf8(eventArgs.name), "shorts" , "should be the product name in bytes32");
          assert.strictEqual(eventArgs.price.toNumber(), 15, "should be the product price");
          assert.strictEqual(eventArgs.stock.toNumber(), 20, "should be the product stock");
          return shopfront.getProductCount.call();
        })
        .then(function(count) {
          assert.strictEqual(count.toNumber(), 2, "should have add a product");
          return shopfront.getProductIdAt(1);
        })
        .then(function (id) {
          assert.strictEqual(id.toNumber(), 2, "should be the first id");
          return shopfront.getProduct(2);
        })
        .then(function(values) {
          assert.strictEqual(web3.toUtf8(values[0]), "shorts" , "should be the product name in bytes32");
          assert.strictEqual(values[1].toNumber(), 15, "should be the product price");
          assert.strictEqual(values[2].toNumber(), 20, "should be the product stock");
        });
    });

    it("should not be possible to add a product if already exists", function() {
      return expectedExceptionPromise(function () {
        return shopfront.addProduct(
            1, "shirt", 10, 1,
            { from: accounts[1], value: 9, gas: 3000000 });     
          },
          3000000);
      });

    it("should be possible to remove a product", function() {
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
          assert.strictEqual(eventArgs.id.toNumber(), 1, "should be the product id");
          assert.strictEqual(web3.toUtf8(eventArgs.name), "shirt" , "should be the product name in bytes32");
          assert.strictEqual(eventArgs.price.toNumber(), 10, "should be the product price");
          assert.strictEqual(eventArgs.stock.toNumber(), 1, "should be the product stock");
          return shopfront.getProductCount();
        })
        .then(function(count) {
          assert.strictEqual(count.toNumber(), 1, "should have removed the product, so the count should be 1");
          return shopfront.getProductIdAt(0);
        })
        .then(function (id) {
          assert.strictEqual(id.toNumber(), 2, "should be the first id");
          return shopfront.getProduct(2);
        })
        .then(function(values) {
          assert.strictEqual(web3.toUtf8(values[0]), "shorts" , "should be the product name in bytes32");
          assert.strictEqual(values[1].toNumber(), 15, "should be the product price");
          assert.strictEqual(values[2].toNumber(), 20, "should be the product stock");
        });
      }); 
    });



  describe("Test buyers capabilities", function(){
    var blockNumber;
    before('Deploy a new Shopfront contract', function() {
      return Shopfront.new({}, {from: accounts[0]})
      .then(function(_shopfront) {
        shopfront = _shopfront;
      });
    });

    it("should be possible to add a product", function() {
      var blockNumber;
      return shopfront.addProduct.call(1, "shirt", 10, 1, { from: accounts[0] })
        .then(function(successful) {
          assert.isTrue(successful, "should be possible to add a product");
          blockNumber = web3.eth.blockNumber + 1;
          return shopfront.addProduct(1, "shirt", 10, 2, { from: accounts[0] });
        })
        .then(function(tx) {
          return Promise.all([
            getEventsPromise(shopfront.LogProductAdded(
              {},
              { fromBlock: blockNumber, toBlock: "latest" })),
            web3.eth.getTransactionReceiptMined(tx)
          ]);
        })
      });

    it("should not be possible to purchase a product below price", function() {
      return expectedExceptionPromise(function () {
        return shopfront.buyProduct(
            1, 
            { from: accounts[1], value: 9, gas: 3000000 });     
          },
          3000000);
      });

    it("should not be possible to purchase a non existing product", function() {
      return expectedExceptionPromise(function () {
        return shopfront.buyProduct(
            10,
            { from: accounts[1], value: 90, gas: 3000000 });     
          },
          3000000);
      });

    it("should be possible to purchase a product at exact price", function() {
      return shopfront.buyProduct.call(1, { from: accounts[1], value: 10 })
        .then(function (successful) {
          assert.isTrue(successful, "should be possible to purchase");
          blockNumber = web3.eth.blockNumber + 1;
          return shopfront.buyProduct(1, { from: accounts[1], value: 10 });
        })
        .then(function(tx) {
          return Promise.all([
            getEventsPromise(shopfront.LogProductPurchased(
              {},
              { fromBlock: blockNumber, toBlock: "latest" })),
            web3.eth.getTransactionReceiptMined(tx)
          ]);
        })
        .then(function (eventAndReceipt) {
          var eventArgs = eventAndReceipt[0][0].args;
          assert.strictEqual(eventArgs.id.toNumber(), 1, "should be the product id");
          assert.strictEqual(eventArgs.customer, accounts[1], "should be the customer address");
          assert.strictEqual(eventArgs.stock.toNumber(), 1, "should be the product stock");
          assert.strictEqual(eventArgs.cashDifference.toNumber(),0, "should be the cash difference");
        })
      });

    it("should be possible to purchase a product at a highest price", function() {
      return shopfront.buyProduct.call(1, { from: accounts[1], value: 20 })
        .then(function (successful) {
          assert.isTrue(successful, "should be possible to purchase");
          blockNumber = web3.eth.blockNumber + 1;
          return shopfront.buyProduct(1, { from: accounts[1], value: 20 });
        })
        .then(function(tx) {
          return Promise.all([
            getEventsPromise(shopfront.LogProductPurchased(
              {},
              { fromBlock: blockNumber, toBlock: "latest" })),
            web3.eth.getTransactionReceiptMined(tx)
          ]);
        })
        .then(function (eventAndReceipt) {
          var eventArgs = eventAndReceipt[0][0].args;
          assert.strictEqual(eventArgs.id.toNumber(), 1, "should be the product id");
          assert.strictEqual(eventArgs.customer, accounts[1], "should be the customer address");
          assert.strictEqual(eventArgs.stock.toNumber(), 0, "should be the product stock");
          assert.strictEqual(eventArgs.cashDifference.toNumber(),10, "should be the cash difference");
        })
      });

    it("should not be possible to purchase a product in 0 stock", function() {
      return expectedExceptionPromise(function () {
        return shopfront.buyProduct(
            1,
            { from: accounts[1], value: 90, gas: 3000000 });     
          },
          3000000);
      });

    });

  describe("Test withdraw capabilities", function(){
    before('Deploy a new Shopfront contract', function() {
      return Shopfront.new({}, {from: accounts[0]})
      .then(function(_shopfront) {
        shopfront = _shopfront;
      });
    });

    it("should be possible to add a product", function() {
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
      });

    it("should not be possible to withdraw money with no purchases before", function() {
      return expectedExceptionPromise(function () {
        return shopfront.withdrawMoney(
            100, 
            { from: accounts[0], gas: 3000000 });     
          },
          3000000);
      });

    it("should be possible to purchase a product at exact price", function() {
      return shopfront.buyProduct.call(1, { from: accounts[1], value: 10 })
        .then(function (successful) {
          assert.isTrue(successful, "should be possible to purchase");
          blockNumber = web3.eth.blockNumber + 1;
          return shopfront.buyProduct(1, { from: accounts[1], value: 10 });
        })
        .then(function(tx) {
          return Promise.all([
            getEventsPromise(shopfront.LogProductPurchased(
              {},
              { fromBlock: blockNumber, toBlock: "latest" })),
            web3.eth.getTransactionReceiptMined(tx)
          ]);
        })
        .then(function (eventAndReceipt) {
          var eventArgs = eventAndReceipt[0][0].args;
          assert.strictEqual(eventArgs.id.toNumber(), 1, "should be the product id");
          assert.strictEqual(eventArgs.customer, accounts[1], "should be the customer address");
        })
      });

    it("shouldn't be possible to withdraw money if not owner", function() {
      return expectedExceptionPromise(function () {
        return shopfront.withdrawMoney(
            100, 
            { from: accounts[1], gas: 3000000 });     
          },
          3000000);
       });

    it("should be possible to withdraw", function() {
      var blockNumber;
      return shopfront.withdrawMoney.call(10, { from: accounts[0] })
        .then(function(successful) {
          assert.isTrue(successful, "should be possible to withdraw money");
          blockNumber = web3.eth.blockNumber + 1;
          return shopfront.withdrawMoney(10, { from: accounts[0] });
        })
        .then(function(tx) {
          return Promise.all([
            getEventsPromise(shopfront.LogWithdrawedValue(
              {},
              { fromBlock: blockNumber, toBlock: "latest" })),
            web3.eth.getTransactionReceiptMined(tx)
          ]);
        })
        .then(function (eventAndReceipt) {
            var eventArgs = eventAndReceipt[0][0].args;
            assert.strictEqual(eventArgs.valueToSend.toNumber(), 10, "should be the money withdrawed");
            assert.strictEqual(eventArgs.contractValue.toNumber(), 0, "should be the contract money");
            
          })
      });
  });
});