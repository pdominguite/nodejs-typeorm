import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('could not find any customer with the given id');
    }

    const availableProducts = await this.productsRepository.findAllById(
      products,
    );

    if (availableProducts.length !== products.length) {
      throw new AppError('some products does not exist');
    }

    const serializedProducts = availableProducts.map(p => {
      const orderedProduct = products.filter(product => product.id === p.id)[0];

      const newQuantity = p.quantity - orderedProduct.quantity;

      if (newQuantity < 0) {
        throw new AppError(
          `insufficient quantity for product ${p.id} on stock`,
        );
      }

      return {
        product_id: p.id,
        price: p.price,
        quantity: orderedProduct.quantity,
      };
    });

    const updateProducts = availableProducts.map(product => ({
      id: product.id,
      quantity:
        product.quantity -
        serializedProducts.filter(p => p.product_id === product.id)[0].quantity,
    }));

    await this.productsRepository.updateQuantity(updateProducts);

    return this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });
  }
}

export default CreateOrderService;
