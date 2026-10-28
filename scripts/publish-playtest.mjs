#!/usr/bin/env node
/** Publish explicitly requested test artifacts; never force-push a branch. */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, options={}) => execFileSync('git', args, {cwd:root, encoding:'utf8', ...options}).trim();
git(['rev-parse','--verify','HEAD']);
const gitDir = git(['rev-parse','--absolute-git-dir']);
const download = resolve(root,'artifacts/playtest');
await mkdir(download,{recursive:true});
await copyFile(resolve(root,'artifacts/Mahub-kull.html'),join(download,'Mahub-kull.html'));
await writeFile(join(download,'ALUSTA-SIIT.txt'),
  'Mahub küll! — arvuti prooviversioon\n\n1. Paki ZIP lahti.\n2. Ava Mahub-kull.html Chrome’i, Edge’i või Firefoxiga.\n\nMäng ei vaja paigaldust ega internetti. Lohista esemeid kohvrisse.\nVali ese ja pööra seda nupu või R-klahviga. Vihje aitab edasi.\nEdenemine salvestub brauserisse; kohalike failide salvestusreeglid sõltuvad brauserist.\n', 'utf8');
await writeFile(resolve(root,'dist-pages/.nojekyll'),'');

async function commitFiles(branch,directory) {
  const temporary = await mkdtemp(join(tmpdir(),'mahub-playtest-'));
  const env = {...process.env,GIT_INDEX_FILE:join(temporary,'index')};
  const ref = `refs/heads/${branch}`;
  try {
    let parent;
    try { parent=git(['rev-parse','--verify',ref],{stdio:['ignore','pipe','ignore']}); } catch { parent=null; }
    git(['read-tree','--empty'],{env});
    git([`--git-dir=${gitDir}`,`--work-tree=${directory}`,'add','--all'],{env,cwd:directory});
    const tree=git(['write-tree'],{env});
    const args=['commit-tree',tree,...(parent ? ['-p',parent] : [])];
    const commit=git(args,{input:`Publish Mahub küll! ${branch} test build\n`});
    git(['update-ref',ref,commit,parent || '0000000000000000000000000000000000000000']);
    console.log(`${branch}: ${commit}`);
  } finally { await rm(temporary,{recursive:true,force:true}); }
}
await commitFiles('gh-pages',resolve(root,'dist-pages'));
await commitFiles('playtest',download);
git(['push','origin','refs/heads/gh-pages','refs/heads/playtest'],{stdio:'inherit'});
console.log('Test builds sent to GitHub. Configure Pages to deploy gh-pages /(root).');
