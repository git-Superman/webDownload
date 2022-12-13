const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const URL = require('url');


const { saveDir, saveImageDir, saveJsDir, saveCssDir } = createSaveDir('dist');


app('http://www.zhdbwy.com/xuexipeixun/');



// 下载网页
async function app(url){

    let basename = path.basename(url);
    let response = await axios.get(url);

    let _path = path.resolve(saveDir, `${basename}`);
    if( !/\.html$/.test(_path) ) _path = `${_path}.html`;

    let { html, static } = await app_static( response.data, {
        _path,
        url
    });
}



// 下载css中的图片
async function app_static_download_style( content, url ){

    // buffer 转成文本
    content = typeof content === 'object' ? content.toString() : content;

    // 筛选路径
    let list = content.match(/url\((.*?)\)/ig) || [],
        result = {};

    list.forEach(item => {
        let src = item.replace(/\s*/g,'').replace(/^url\(/,'').replace(/\)$/,'')
        if( !/^data:/.test(src) ) { // 去除本地路径
            result[src] = URL.resolve( url, src );
        }
    });

    for(let key in result) {
        let item = result[key];
        let s = await app_static_download(item);
        content = content.replace(key, `../${s}`)
    }

    return content;
}



// 下载静态资源  js css img
async function app_static( html, option){

    const $ = cheerio.load(html),
        { url, _path } = option || {};

    let static = {
        script: {},
        img: {},
        link: {}
    };

    $('link[href], script[src], img[src]').each((i,item) => {
        let src = $(item).attr('href') || $(item).attr('src');
        if( static[item.name] && !/^(http|https)/.test(src) ) {
            let val = src.indexOf('?') == -1 ? src : src.split('?')[0];
            static[item.name][src] = URL.resolve(url, val);
        }
    });

    // 去除链接地址
    $('a[href]').attr('href','javascript:;');
    html = $.html();


    return new Promise(resolve => {

        let keys = Object.keys( static )
        let i = 0, len = keys.length;
        keys.forEach(async key => {
            
            let item = static[key];
            if( item ){
                for(let ol in item ) {
                    let _u = await app_static_download(item[ol]);
                    html = html.replace(ol, _u);
                }
            }

            i++
            if( i === len ) {
                fs.writeFileSync( _path, html, 'utf-8' );
                resolve({ html, static });
            }
        });

    });
}



// 下载文件
function app_static_download(url){

    let basename = path.basename( url );
    let extname = path.extname( url );
    let dir, replace_dir;

    switch(extname){
        case '.js':
            dir = saveJsDir
            replace_dir = `${path.basename(saveJsDir)}/${basename}`;
            break;
        case '.css':
            dir = saveCssDir
            replace_dir = `${path.basename(saveCssDir)}/${basename}`;
            break;
        default:
            dir = saveImageDir
            replace_dir = `${path.basename(saveImageDir)}/${basename}`;
    }

    let save_dir = path.resolve(dir, basename);

    // 不存在即开始下载
    if( !fs.existsSync(save_dir) ) {
        return new Promise(resolve => {
            axios.get(url, { responseType:'arraybuffer' }).then(res => {
                setTimeout(async () => {
                    let data = res.data;
                    if( /\.css$/.test( url ) ) {
                        data = await app_static_download_style(data, url);
                    }
                    fs.writeFileSync(save_dir, res.data );
                },20);
                console.log('\n下载成功。。\n')
                resolve(replace_dir);
            }).catch((err) => {
                console.log(`\n\n下载失败。。\nErr Message: ${err.message}  \nTarget Url: ${url}\n\n`)
                resolve(replace_dir);
            });
        })
    } else {
        return Promise.resolve(replace_dir);
    }
}


// 生成保存目录
function createSaveDir(...dir){
    const saveDir = path.resolve(__dirname, ...dir);
    if( !fs.existsSync(saveDir) ) fs.mkdirSync(saveDir);

    let dirs = ['images','js','css'];
    dirs.forEach(item => {
        let _dir = path.resolve(saveDir, item);
        if( !fs.existsSync(_dir) ) fs.mkdirSync(_dir);
    });

    let saveImageDir = path.resolve(saveDir, dirs[0]);
    let saveJsDir = path.resolve(saveDir, dirs[1]);
    let saveCssDir = path.resolve(saveDir, dirs[2]);

    return { 
        saveDir, 
        saveImageDir,
        saveJsDir,
        saveCssDir
    }
}