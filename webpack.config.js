const path = require('path');
const { VueLoaderPlugin } = require('vue-loader')
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports =  (env = {}) => ({
	entry: {
		app: './src/main.js',
	},
	mode: env.production ? 'production' : 'development',	
	output: {
		path: path.resolve(__dirname, './dist'),
	},
	resolve: {
		extensions: ['.ts', '.js', '.vue', '.json'],
    	alias: {
			vue: 'vue/dist/vue.esm-bundler.js'
    	}
	},
	module: {
		rules: [
			{
	        	test: /\.vue$/,
				loader: 'vue-loader'
			}, 
			{
        		test: /\.js$/,
        		exclude: /node_modules/,
        		use: ["babel-loader"]
      		},
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader']
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: ['file-loader']
            }
		]
	},
	plugins: [
		new CleanWebpackPlugin(),
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, './src/index.html'),
			filename: 'index.html',
		}),    
		new MiniCssExtractPlugin({
      		filename: '[name].css'
    	}),
		new VueLoaderPlugin(),
	],
	devServer: {
    	inline: true,
    	hot: true,
    	stats: 'minimal',
    	contentBase: path.resolve(__dirname, "public"),
    	overlay: true,
	}
});
