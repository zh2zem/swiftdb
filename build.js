const { build } = require('esbuild');
const { readFileSync, writeFileSync } = require('fs');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = process.env.TGT_RELEASE_VERSION || pkg.version;

build({
  bundle: true,
  entryPoints: ['./src/index.ts'],
  outfile: 'dist/build.js',
  keepNames: true,
  platform: 'node',
  target: ['node22'],
  format: 'cjs',
}).then(() => {
  console.log(`swiftdb ${version} built successfully`);

  const manifest = `fx_version 'cerulean'
game 'common'
use_experimental_fxv2_oal 'yes'
lua54 'yes'
node_version '22'

name 'swiftdb'
author '${pkg.author}'
version '${version}'
license '${pkg.license}'
description '${pkg.description}'

dependencies { '/server:12913' }

server_script 'dist/build.js'

provide 'mysql-async'
provide 'ghmattimysql'
provide 'oxmysql'
`;

  writeFileSync('fxmanifest.lua', manifest);
  console.log('fxmanifest.lua generated');
});
