import supertest from 'supertest';
import { TestServerFixture } from '../tests/fixtures';

jest.setTimeout(30000);

describe('Webinar Routes E2E', () => {
  let fixture: TestServerFixture;

  beforeAll(async () => {
    fixture = new TestServerFixture();
    await fixture.init();
  });

  beforeEach(async () => {
    await fixture.reset();
  });

  afterAll(async () => {
    await fixture.stop();
  });

  it('should organize a webinar', async () => {
    // ARRANGE
    const prisma = fixture.getPrismaClient();
    const server = fixture.getServer();
    const startDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    // ACT
    const response = await supertest(server)
      .post('/webinars')
      .send({
        userId: 'test-user',
        title: 'Webinar Test',
        seats: 10,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      .expect(201);

    // ASSERT
    expect(response.body).toEqual({ id: 'id-1' });

    const createdWebinar = await prisma.webinar.findUnique({
      where: { id: 'id-1' },
    });
    expect(createdWebinar).toEqual({
      id: 'id-1',
      organizerId: 'test-user',
      title: 'Webinar Test',
      startDate,
      endDate,
      seats: 10,
    });
  });

  it('should update webinar seats', async () => {
    // ARRANGE
    const prisma = fixture.getPrismaClient();
    const server = fixture.getServer();

    const webinar = await prisma.webinar.create({
      data: {
        id: 'test-webinar',
        title: 'Webinar Test',
        seats: 10,
        startDate: new Date(),
        endDate: new Date(),
        organizerId: 'test-user',
      },
    });

    // ACT
    const response = await supertest(server)
      .post(`/webinars/${webinar.id}/seats`)
      .send({ seats: '30' })
      .expect(200);

    // ASSERT
    expect(response.body).toEqual({ message: 'Seats updated' });

    const updatedWebinar = await prisma.webinar.findUnique({
      where: { id: webinar.id },
    });
    expect(updatedWebinar?.seats).toBe(30);
  });

  it('should return 404 when webinar does not exist', async () => {
    // ARRANGE
    const server = fixture.getServer();

    // ACT
    const response = await supertest(server)
      .post('/webinars/unknown-webinar/seats')
      .send({ seats: '30' })
      .expect(404);

    // ASSERT
    expect(response.body).toEqual({ error: 'Webinar not found' });
  });

  it('should return 401 when user is not the organizer', async () => {
    // ARRANGE
    const prisma = fixture.getPrismaClient();
    const server = fixture.getServer();

    const webinar = await prisma.webinar.create({
      data: {
        id: 'test-webinar-not-organizer',
        title: 'Webinar Test',
        seats: 10,
        startDate: new Date(),
        endDate: new Date(),
        organizerId: 'another-user',
      },
    });

    // ACT
    const response = await supertest(server)
      .post(`/webinars/${webinar.id}/seats`)
      .send({ seats: '30' })
      .expect(401);

    // ASSERT
    expect(response.body).toEqual({
      error: 'User is not allowed to update this webinar',
    });
  });
});
