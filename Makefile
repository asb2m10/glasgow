glasgow.js: max.js api.js vendor/underscore.js
	cat max.js api.js vendor/underscore.js > build/glasgow.js

test:
	cat api.js vendor/underscore.js test.js node-rt.js > build/mocha-test.js
	mocha build/mocha-test.js

clean:
	rm build/glasgow.js
	rm build/mocha-test.js
