const path = require('path');
const webpack = require('webpack');
const package = require('./package.json')
const TerserPlugin = require("terser-webpack-plugin");

const basePlugins = [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-transform-optional-chaining',
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-template-literals', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
];

const mode = process.env.NODE_ENV || 'production'

const baseConfig = {
    entry: path.resolve(__dirname, 'src', 'index.js'),
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components|[\\/]dist[\\/]TronWeb\.js$)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    // browsers: [
                                    //     '>0.25%',
                                    //     'not dead'
                                    // ]
                                }
                            }]
                        ],
                        plugins: basePlugins
                    }
                }
            },
            {
                // tronweb's prebuilt dist targets '>0.25%, not dead', which drifts with each release
                // (since 6.5.1 it ships ?. and ??). Transpile it to the browserslist in package.json instead.
                test: /[\\/]node_modules[\\/]tronweb[\\/]dist[\\/]TronWeb\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        babelrc: false,
                        configFile: false,
                        sourceType: 'script',
                        compact: true,
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        modules: [
            'node_modules',
            path.resolve(__dirname, 'src')
        ],
    },
    // devtool: 'source-map',
    mode
};

nodePlugins = [
    ...basePlugins
]

if (mode === 'development') {
    nodePlugins.push('source-map-support')
}

module.exports = [
    {
        ...baseConfig,
        output: {
            path: path.resolve(__dirname, 'build'),
            filename: `tronweb-mobile-${package.version}.js`,
            library: 'tronweb-mobile',
            libraryTarget: 'umd',
            libraryExport: 'default',
            umdNamedDefine: true
        },
        plugins: [
            new webpack.BannerPlugin(`version:${package.version}`),
            new webpack.ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
        ],
        optimization: {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    extractComments: false,
                }),
            ],
        },
        resolve: {
            alias: {
                // tronweb's package exports don't expose dist/, so point at the prebuilt browser UMD bundle directly
                'tronweb/dist/TronWeb.js$': path.resolve(__dirname, 'node_modules/tronweb/dist/TronWeb.js'),
            },
            fallback: {
                buffer: require.resolve('buffer/'),
                crypto: require.resolve('crypto-browserify'),
            },
        },
 
    }
];
