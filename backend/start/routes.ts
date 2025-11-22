/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| This file is dedicated for defining HTTP routes. A single file is enough
| for majority of projects, however you can define routes in different
| files and just make sure to import them inside this file. For example
|
| Define routes in following two files
| ├── start/routes/cart.ts
| ├── start/routes/customer.ts
|
| and then import them inside `start/routes.ts` as follows
|
| import './routes/cart'
| import './routes/customer'
|
*/

import Route from '@ioc:Adonis/Core/Route'

Route.get('/', async () => ({ status: 'ok' }))

Route.post('/auth/verify', 'AuthController.verify')

Route.get('/traders', 'TradersController.index')
Route.post('/traders', 'TradersController.store')

Route.get('/signals', 'SignalsController.index')
Route.post('/signals', 'SignalsController.store')

Route.get('/subscriptions', 'SubscriptionsController.index')
Route.post('/subscriptions', 'SubscriptionsController.store')
