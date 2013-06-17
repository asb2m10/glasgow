glasgow.js: max.js api.js modal.js vendor/underscore.js
	cat max.js api.js modal.js vendor/underscore.js > build/glasgow.js

test:
	cat api.js modal.js vendor/underscore.js test.js node-rt.js > build/mocha-test.js
	mocha build/mocha-test.js

test-lisp:
	cat api.js modal.js vendor/underscore.js vendor/parks-lisp.js test-lisp.js node-rt.js > build/mocha-testlisp.js
	mocha build/mocha-testlisp.js

clean:
	rm build/glasgow.js
	rm build/mocha-test.js

readme:
	marked README.md -o build/readme.html

selfzip:
	zip ../glasgow-`date +'%m-%d-%Y'`.zip -pp glasgow -r *