#!/usr/bin/env node
console.log(process.argv);
switch(process.argv[2]) {
    case 'estrella':
    import('estrella').then(b => {
        b.build({
            entry: 'example/index.ts',
            bundle: true,
            minify: false,
            sourcemap: 'external',
            target: ['es2020'],
            platform: 'node',
            // format: 'cjs',
            // outfile: 'dist/example/server.cjs',
            format: 'esm',
            outfile: 'dist/example/server.js',
            // banner: { js: `require('source-map-support').install();` },
            // banner: { js: `import 'source-map-support@0.5.19/node_modules/source-map-support/register.js';` },
            // banner: { js: `import 'source-map-support/register';` },
            loader: { '.svg': 'dataurl' },
            define: { DEBUG: 'true', NODE_ENV: 'develop' },
        });
    });
case 'example':
    import('esbuild').then(b => {
        b.buildSync({
            entryPoints: ['example/App.tsx'],
            bundle: false,
            minify: false,
            sourcemap: 'both',
            target: ['es2020'],
            platform: 'browser',
            format: 'esm',
            outfile: 'dist/example/client/script.js',
            // banner: { js: `import 'source-map-support/register';` },
            // banner: { js: `import 'source-map-support@0.5.19/node_modules/source-map-support/register.js';` },
            loader: { '.svg': 'dataurl' },
            define: { DEBUG: 'true', NODE_ENV: 'develop' },
        });
        b.buildSync({
            entryPoints: ['example/index.ts'],
            bundle: false,
            minify: false,
            sourcemap: 'external',
            target: ['es2020'],
            platform: 'node',
            // format: 'cjs',
            // outfile: 'dist/example/server.cjs',
            format: 'esm',
            outfile: 'dist/example/server.js',
            // banner: { js: `require('source-map-support').install();` },
            // banner: { js: `import 'source-map-support@0.5.19/node_modules/source-map-support/register.js';` },
            // banner: { js: `import 'source-map-support/register';` },
            loader: { '.svg': 'dataurl' },
            define: { DEBUG: 'true', NODE_ENV: 'develop' },
        });
    });
case 'src':
default:
    import('esbuild').then(b => b.buildSync({
        entryPoints: ['src/index.ts'],
        bundle: true,
        minify: false,
        sourcemap: 'external',
        target: ['es2020'],
        platform: 'browser',
        format: 'esm',
        outfile: 'dist/glamor-jss.js',
        // banner: { js: `import 'source-map-support/register';` },
        define: { DEBUG: 'true', NODE_ENV: 'develop' },
    }));
}
